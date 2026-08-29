// Pending print-job fetch/ack + kitchen/invoice print execution (P3.4 split
// of printer.ts). Depends on agent-transport.ts (dispatch to local agent) and
// config-api.ts (renderMobileEscpos) — the top of the printer/ import graph.
import { apiRequest, ServiceError } from "@/lib/api";
import { Capacitor } from "@capacitor/core";
import {
  failPayload,
  getPrinterDeliveryState,
  getPrinterErrorMessage,
  textValue
} from "@/services/printer/helpers";
import {
  dispatchPrintJob,
  isBrowserDevicePrintJob,
  printBatchWithLocalAgent,
  printJobAgentBase,
  resolvePrinterDeviceContext
} from "@/services/printer/agent-transport";
import { renderMobileEscpos } from "@/services/printer/config-api";
import { printMobileEscposOverTcp } from "@/services/printer/mobile-tcp";
import type {
  AckPayload,
  AckResponse,
  ExecuteInvoicePrintInput,
  ExecuteKitchenPrintInput,
  ExecuteReportPrintInput,
  KitchenPrintResult,
  PendingPrintItem,
  PendingPrintJobData,
  PendingPrintJobsFullResponse,
  PendingPrintJobsParams,
  PendingPrintJobsResult,
  PrintJob,
  PrintOpsBatchPayload,
  PrinterDeliveryState,
} from "@/services/printer/types";

const printerQueues = new Map<string, Promise<void>>();
const kitchenExecutions = new Map<string, Promise<KitchenPrintResult>>();
const deliveryLedgerMemory = new Map<string, StoredDelivery>();
const DELIVERY_LEDGER_PREFIX = "yummy_kitchen_printer_delivery:";

interface StoredDelivery {
  deliveryState: Exclude<PrinterDeliveryState, "not_sent">;
  errorMessage?: string;
}

function runOnPrinterQueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = printerQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  const tail = current.then(() => undefined, () => undefined);
  printerQueues.set(key, tail);
  void tail.finally(() => {
    if (printerQueues.get(key) === tail) printerQueues.delete(key);
  });
  return current;
}

function printerBatchQueueKey(batch: PrintOpsBatchPayload) {
  return (
    textValue(batch.print_config_uuid) ||
    [
      textValue(batch.agent_id),
      textValue(batch.device_code),
      textValue(batch.interface_value || batch.jobs?.[0]?.interface_value),
    ].join("|")
  );
}

function deliveryLedgerKey(jobUuid: string, batch: PrintOpsBatchPayload) {
  return `${DELIVERY_LEDGER_PREFIX}${jobUuid}:${printerBatchQueueKey(batch)}`;
}

function deliveryStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readStoredDelivery(key: string): StoredDelivery | null {
  const memoryValue = deliveryLedgerMemory.get(key);
  if (memoryValue) return memoryValue;
  try {
    const raw = deliveryStorage()?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDelivery;
    if (parsed.deliveryState !== "printed" && parsed.deliveryState !== "unknown") {
      return null;
    }
    deliveryLedgerMemory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function storeDelivery(key: string, delivery: StoredDelivery) {
  deliveryLedgerMemory.set(key, delivery);
  try {
    deliveryStorage()?.setItem(key, JSON.stringify(delivery));
  } catch {
    // Memory still protects duplicate requests in the current app session.
  }
}

function clearStoredDelivery(key: string) {
  deliveryLedgerMemory.delete(key);
  try {
    deliveryStorage()?.removeItem(key);
  } catch {
    // The committed backend ACK is authoritative even if local cleanup fails.
  }
}

export async function getPendingPrintJobs(params: PendingPrintJobsParams): Promise<PendingPrintJobsResult> {
  const result = await apiRequest<PendingPrintJobsFullResponse>("get", "/api/v1/printer/jobs/pending", {
    params: {
      print_job_uuid: params.print_job_uuid,
      login_uuid_fk: params.login_uuid_fk,
      device_code: params.device_code,
      agent_id: params.agent_id,
      print_mode: params.print_mode
    }
  });
  const hasBatchPayloads = Array.isArray(result.print_batch_payloads);
  return {
    jobs: result.data ?? [],
    batchPayloads: hasBatchPayloads ? result.print_batch_payloads ?? [] : [],
    hasBatchPayloads,
    ackSuccess: result.ack_success_payload ?? null,
    ackFailed: result.ack_failed_payload ?? null,
    printSummary: result.print_summary ?? {},
    pendingJobRefs: result.pending_job_refs ?? [],
  };
}
export const ackPrintJob = (payload: AckPayload) =>
  apiRequest<AckResponse>("post", "/api/v1/printer/jobs/ack", {
    data: payload
  });

function ackPayloadWithLogin(payload: AckPayload, loginUuid: string): AckPayload {
  return { ...payload, login_uuid_fk: payload.login_uuid_fk ?? loginUuid };
}

function reportKitchenProgress(
  input: ExecuteKitchenPrintInput,
  total: number,
  successCount: number,
  failedCount: number,
  skippedCount: number
) {
  input.onProgress?.({
    total,
    completed: successCount + failedCount + skippedCount,
    successCount,
    failedCount,
    phase: "printing"
  });
}

function kitchenCutMode(input: ExecuteKitchenPrintInput, pending: PendingPrintJobData[]) {
  return textValue(input.print_job?.cut_mode) || textValue(pending.find((job) => textValue(job.cut_mode))?.cut_mode) || "per_ticket";
}

function groupKitchenBatchItems(items: PendingPrintItem[]) {
  const groups = new Map<string, PendingPrintItem[]>();

  for (const item of items) {
    if (!item.job) continue;
    const key = printJobAgentBase(item.job);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return Array.from(groups.values());
}

async function printKitchenMobileBatch(batch: PrintOpsBatchPayload) {
  const mobileEscpos = batch.mobile_escpos ?? null;

  const batchEscposBase64 = textValue(mobileEscpos?.escpos_base64);

  const batchInterfaceValue =
    textValue(mobileEscpos?.interface_value) ||
    textValue(batch.interface_value) ||
    textValue(batch.jobs?.[0]?.interface_value);

  if (batchEscposBase64) {
    if (!batchInterfaceValue) {
      throw new ServiceError("Mobile printer interface_value missing", 400);
    }

    await printMobileEscposOverTcp({
      interface_value: batchInterfaceValue,
      escpos_base64: batchEscposBase64,
    });

    return;

  }

  if (!batch.jobs?.length) {
    throw new ServiceError(
      batch.mobile_error || "Mobile ESC/POS payload missing",
      500
    );
  }

  for (const job of batch.jobs) {
    const jobInterfaceValue =
      textValue(job.interface_value) ||
      batchInterfaceValue;

    if (!jobInterfaceValue) {
      throw new ServiceError("Mobile printer interface_value missing", 400);
    }

    const escposBase64 = await renderMobileEscpos(job);

    await printMobileEscposOverTcp({
      interface_value: jobInterfaceValue,
      escpos_base64: escposBase64,
    });

  }
}

function isMobilePrintBatch(batch: PrintOpsBatchPayload) {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const printClient = textValue(batch.print_client).toLowerCase();
  const printMode = textValue(batch.print_mode).toLowerCase();
  const interfaceValue = textValue(
    batch.mobile_escpos?.interface_value ||
    batch.interface_value ||
    batch.jobs?.[0]?.interface_value
  ).toLowerCase();

  return (
    printClient === "mobile_wifi" ||
    printMode === "mobile_wifi" ||
    interfaceValue.startsWith("tcp://") ||
    Boolean(textValue(batch.mobile_escpos?.escpos_base64))
  );
}

function printBatchJobTotal(batch: PrintOpsBatchPayload) {
  const jobsTotal = Array.isArray(batch.jobs) ? batch.jobs.length : 0;
  const declaredTotal = Number(batch.job_total || 0);

  return jobsTotal || declaredTotal || 0;
}

interface BatchPrintOutcome {
  deliveryState: PrinterDeliveryState;
  errorMessage?: string;
  itemUuids: string[];
  ledgerKey: string;
  printConfigUuid: string;
  success: boolean;
}

function batchPrintJobItemUuids(batch: PrintOpsBatchPayload) {
  const itemUuids = [
    ...(Array.isArray(batch.print_job_item_uuids)
      ? batch.print_job_item_uuids
      : []),
    ...(Array.isArray(batch.jobs)
      ? batch.jobs.flatMap((job) => [
        textValue(job.print_job_item_uuid),
        textValue(job.meta?.print_job_item_uuid),
      ])
      : []),
  ].filter(Boolean);

  return [...new Set(itemUuids)];
}

function batchAckPayload({
  failedPayload,
  outcomes,
  successPayload,
}: {
  failedPayload: AckPayload | null;
  outcomes: BatchPrintOutcome[];
  successPayload: AckPayload | null;
}) {
  const basePayload = successPayload ?? failedPayload;
  if (!basePayload) return null;

  const unmappedOutcome = outcomes.find((outcome) => !outcome.itemUuids.length);
  if (unmappedOutcome) {
    // Older backends did not expose queue-item IDs on each physical-printer
    // batch. Preserve the former all-or-nothing ACK for that response because
    // guessing an item/printer relationship could confirm the wrong order.
    const failedOutcome = outcomes.find((outcome) => !outcome.success);
    if (failedOutcome) {
      return failedPayload
        ? failPayload(
          failedPayload,
          failedOutcome.errorMessage || "Printer batch failed",
        )
        : null;
    }
    return successPayload;
  }

  const successByItem = new Map(
    (successPayload?.results ?? []).map((result) => [
      result.print_job_item_uuid,
      result,
    ]),
  );
  const failedByItem = new Map(
    (failedPayload?.results ?? []).map((result) => [
      result.print_job_item_uuid,
      result,
    ]),
  );
  const outcomesByItem = new Map<string, BatchPrintOutcome[]>();
  for (const outcome of outcomes) {
    for (const itemUuid of outcome.itemUuids) {
      outcomesByItem.set(itemUuid, [...(outcomesByItem.get(itemUuid) ?? []), outcome]);
    }
  }

  const itemUuids = [
    ...new Set([
      ...successByItem.keys(),
      ...failedByItem.keys(),
      ...outcomesByItem.keys(),
    ]),
  ];
  const results: AckPayload["results"] = [];

  for (const itemUuid of itemUuids) {
    const itemOutcomes = outcomesByItem.get(itemUuid) ?? [];
    const successTemplate = successByItem.get(itemUuid);
    const failedTemplate = failedByItem.get(itemUuid);

    if (itemOutcomes.length) {
      // One order item may be mapped to several physical printers. Report each
      // printer independently so backend can gate the item on the full set.
      for (const outcome of itemOutcomes) {
        if (!outcome.success) {
          results.push({
            ...failedTemplate,
            print_job_item_uuid: itemUuid,
            status: "failed",
            reason:
              outcome.errorMessage ||
              failedTemplate?.reason ||
              "Printer batch failed",
            ...(outcome.printConfigUuid
              ? { print_config_uuid: outcome.printConfigUuid }
              : {}),
            delivery_state: outcome.deliveryState,
          });
          continue;
        }
        results.push({
          ...successTemplate,
          print_job_item_uuid: itemUuid,
          status: "success",
          ...(outcome.printConfigUuid
            ? { print_config_uuid: outcome.printConfigUuid }
            : {}),
          delivery_state: "printed",
        });
      }
      continue;
    }

    const skippedTemplate =
      successTemplate?.status === "skipped"
        ? successTemplate
        : failedTemplate?.status === "skipped"
          ? failedTemplate
          : null;
    if (skippedTemplate) {
      results.push(skippedTemplate);
      continue;
    }

    // Items rejected before printing exist only in the failed template. ACK
    // them together with the physical batch results so the job cannot remain
    // indefinitely pending.
    if (!successTemplate && failedTemplate) results.push(failedTemplate);
  }

  return results.length ? { ...basePayload, results } : null;
}

function pendingFailedBeforePrintTotal(result: PendingPrintJobsResult) {
  // นับเฉพาะที่ backend แจ้งชัดใน print_summary เท่านั้น — ตรวจจาก API จริงแล้ว ack_failed_payload
  // เป็น "template" ให้ client กรอกใช้ตอนพิมพ์พลาด (แถว results เป็น status: "failed" เสมอ)
  // ถ้าเอามานับ งานที่สำเร็จปกติจะถูกตีเป็นล้มเหลวปลอม "1/1"
  const summaryTotal = Number(result.printSummary.failed_before_print_total ?? 0);
  return Number.isFinite(summaryTotal) && summaryTotal > 0 ? summaryTotal : 0;
}

function pendingFailedBeforePrintReason(result: PendingPrintJobsResult) {
  return result.ackFailed?.results?.find((item) => item.status === "failed")?.reason || undefined;
}

async function printKitchenBatchJob(batch: PrintOpsBatchPayload) {
  if (!batch.jobs.length) return;
  await printBatchWithLocalAgent(
    batch.jobs,
    undefined,
    textValue(batch.cut_mode) || "per_ticket"
  );
}

async function executePrintJobs(
  input: ExecuteKitchenPrintInput,
  options: { ack: boolean; idempotent?: boolean },
): Promise<KitchenPrintResult> {
  const jobUuid = input.pending_query?.print_job_uuid ?? input.print_job?.print_job_uuid;
  const loginUuid = input.pending_query?.login_uuid_fk ?? input.login_uuid_fk;

  if (!jobUuid || !loginUuid) {
    return {
      successCount: 0,
      failedCount: 0,
      total: 0,
    };
  }

  if (
    input.pending_query?.remote_shared_print === true ||
    input.print_job?.remote_shared_print === true
  ) {
    return {
      successCount: 0,
      failedCount: 0,
      total: 0,
    };
  }

  input.onProgress?.({
    total: 0,
    completed: 0,
    successCount: 0,
    failedCount: 0,
    phase: "fetching",
  });

  const pendingParams =
    input.pending_query?.device_code &&
      input.pending_query.print_job_uuid &&
      input.pending_query.login_uuid_fk
      ? input.pending_query
      : {
        print_job_uuid: jobUuid,
        login_uuid_fk: loginUuid,
        ...(await resolvePrinterDeviceContext({
          login_uuid_fk: loginUuid,
          device_code: input.pending_query?.device_code ?? input.device_code,
          agent_id: input.pending_query?.agent_id ?? input.agent_id,
          print_mode: input.pending_query?.print_mode ?? input.print_mode,
        })),
      };

  const pendingResult = await getPendingPrintJobs(pendingParams);

  const pending = pendingResult.jobs;
  const batchPayloads = pendingResult.batchPayloads;
  const globalAckSuccess = pendingResult.ackSuccess;
  const globalAckFailed = pendingResult.ackFailed;

  if (pendingResult.hasBatchPayloads && batchPayloads.length === 0) {
    // งานครัว (ack:true): backend/agent จัดการคิวพิมพ์และยืนยันสถานะออเดอร์เองทั้งหมด
    // เมนูที่ไม่มี config เครื่องพิมพ์ backend รายงานเป็น failed_before_print แต่ยังยืนยันออเดอร์ให้ตามปกติ
    // จึงไม่ใช่ความล้มเหลวฝั่ง client (workflow ใหม่) — ส่วนงานใบเสร็จ (ack:false) ยังต้องแจ้ง cashier ว่าพิมพ์ไม่ออก
    const failedCount = options.ack ? 0 : pendingFailedBeforePrintTotal(pendingResult);
    input.onProgress?.({
      total: failedCount,
      completed: failedCount,
      successCount: 0,
      failedCount,
      phase: "done",
    });

    return {
      successCount: 0,
      failedCount,
      total: failedCount,
      ...(failedCount > 0
        ? { errorMessage: pendingFailedBeforePrintReason(pendingResult) }
        : {}),
    };
  }

  if (batchPayloads.length > 0) {
    const total = batchPayloads.reduce(
      (sum, batch) => sum + printBatchJobTotal(batch),
      0
    );
    const outcomes: BatchPrintOutcome[] = [];
    let successCount = 0;
    let failedCount = 0;
    let lastErrorMessage: string | undefined;

    input.onProgress?.({
      total,
      completed: 0,
      successCount: 0,
      failedCount: 0,
      phase: "printing",
    });

    const batchOutcomes = await Promise.all(
      batchPayloads.map((batch) => {
        const ledgerKey = deliveryLedgerKey(jobUuid, batch);
        const stored = options.idempotent ? readStoredDelivery(ledgerKey) : null;
        const printConfigUuid = textValue(
          batch.print_config_uuid || batch.jobs?.[0]?.print_config_uuid
        );

        if (stored) {
          return Promise.resolve<BatchPrintOutcome>({
            deliveryState: stored.deliveryState,
            errorMessage: stored.errorMessage,
            itemUuids: batchPrintJobItemUuids(batch),
            ledgerKey,
            printConfigUuid,
            success: stored.deliveryState === "printed",
          });
        }

        return runOnPrinterQueue(printerBatchQueueKey(batch), async () => {
          // A second request can reach this queue while the first is printing.
          const queuedStored = options.idempotent
            ? readStoredDelivery(ledgerKey)
            : null;
          if (queuedStored) {
            return {
              deliveryState: queuedStored.deliveryState,
              errorMessage: queuedStored.errorMessage,
              itemUuids: batchPrintJobItemUuids(batch),
              ledgerKey,
              printConfigUuid,
              success: queuedStored.deliveryState === "printed",
            };
          }

          try {
            if (isMobilePrintBatch(batch)) {
              await printKitchenMobileBatch(batch);
            } else {
              await printKitchenBatchJob(batch);
            }

            if (options.idempotent) {
              storeDelivery(ledgerKey, { deliveryState: "printed" });
            }
            return {
              deliveryState: "printed" as const,
              itemUuids: batchPrintJobItemUuids(batch),
              ledgerKey,
              printConfigUuid,
              success: true,
            };
          } catch (error) {
            const errorMessage = getPrinterErrorMessage(error);
            const deliveryState = getPrinterDeliveryState(error);
            if (options.idempotent && deliveryState === "unknown") {
              storeDelivery(ledgerKey, { deliveryState, errorMessage });
            }
            return {
              deliveryState,
              errorMessage,
              itemUuids: batchPrintJobItemUuids(batch),
              ledgerKey,
              printConfigUuid,
              success: false,
            };
          }
        });
      })
    );

    for (const [outcomeIndex, outcome] of batchOutcomes.entries()) {
      const batch = batchPayloads[outcomeIndex];
      const batchTotal = printBatchJobTotal(batch);
      outcomes.push(outcome);
      if (outcome.success) {
        successCount += batchTotal;
      } else {
        failedCount += batchTotal;
        lastErrorMessage = outcome.errorMessage || lastErrorMessage;
      }
      if (outcomeIndex < batchOutcomes.length - 1) {
        input.onProgress?.({
          total,
          completed: successCount + failedCount,
          successCount,
          failedCount,
          phase: "printing",
        });
      }
    }

    // ACK ตามผลของแต่ละเครื่อง: กระดาษที่ออกจากเครื่องก่อนหน้าต้องอัปเดต
    // order item ได้ แม้เครื่องถัดไปจะติดต่อไม่ได้ ไม่ตีทุก batch เป็น failed รวมกัน
    const ackPayload = options.ack
      ? batchAckPayload({
        failedPayload: globalAckFailed,
        outcomes,
        successPayload: globalAckSuccess,
      })
      : null;
    if (ackPayload) {
      try {
        await ackPrintJob(ackPayloadWithLogin(ackPayload, loginUuid));
        for (const outcome of outcomes) {
          if (options.idempotent && outcome.deliveryState !== "not_sent") {
            clearStoredDelivery(outcome.ledgerKey);
          }
        }
      } catch (error) {
        // Keep the local ledger. A repeated request will ACK the recorded
        // result without sending the bytes to this printer again.
        console.error("[printer] kitchen batch ACK failed", error);
      }
    }

    input.onProgress?.({
      total,
      completed: total,
      successCount,
      failedCount,
      phase: "done",
    });

    return {
      successCount,
      failedCount,
      total,
      ...(failedCount > 0 && lastErrorMessage
        ? { errorMessage: lastErrorMessage }
        : {}),
    };

  }

  const printItems = pending.flatMap((job) => job.print_items ?? []);
  const cutMode = kitchenCutMode(input, pending);

  const items = printItems.filter((item) => {
    if (!item.can_print) return true;
    return Boolean(item.job);
  });

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let lastErrorMessage: string | undefined;
  const batchItems: PendingPrintItem[] = [];

  for (const item of items) {
    try {
      if (item.skip_without_print && item.ack_skipped_payload) {
        if (options.ack) {
          await ackPrintJob(
            ackPayloadWithLogin(item.ack_skipped_payload, loginUuid)
          );
        }

        skippedCount++;

        reportKitchenProgress(
          input,
          items.length,
          successCount,
          failedCount,
          skippedCount
        );

        continue;
      }

      if (!item.can_print) {
        // งานครัว: เมนูที่พิมพ์ไม่ได้ (เช่น ไม่มี config เครื่องพิมพ์) — backend ยืนยันสถานะออเดอร์ให้เอง
        // ส่ง ack ให้ backend ปิดงานตามปกติ แต่ไม่นับเป็นความล้มเหลวฝั่ง client (workflow ใหม่)
        if (options.ack) {
          if (item.ack_failed_payload) {
            await ackPrintJob(
              ackPayloadWithLogin(
                failPayload(item.ack_failed_payload, item.error || "Item cannot print"),
                loginUuid
              )
            ).catch(() => undefined);
          }

          skippedCount++;

          reportKitchenProgress(
            input,
            items.length,
            successCount,
            failedCount,
            skippedCount
          );

          continue;
        }

        throw new ServiceError(item.error || "Item cannot print", 400);
      }

      if (!item.job || (options.ack && !item.ack_success_payload)) {
        throw new ServiceError("Print job payload missing", 400);
      }

      if (!isBrowserDevicePrintJob(item.job)) {
        batchItems.push(item);
        continue;
      }

      await dispatchPrintJob(item.job);

      if (options.ack && item.ack_success_payload) {
        await ackPrintJob(
          ackPayloadWithLogin(item.ack_success_payload, loginUuid)
        );
      }

      successCount++;
    } catch (error) {
      lastErrorMessage = getPrinterErrorMessage(error);
      if (!options.ack || !item.ack_failed_payload) {
        failedCount++;
        continue;
      }

      const deliveryState = item.job && isBrowserDevicePrintJob(item.job)
        ? "not_sent"
        : getPrinterDeliveryState(error);
      await ackPrintJob(
        ackPayloadWithLogin(
          failPayload(
            item.ack_failed_payload,
            lastErrorMessage,
            deliveryState,
            textValue(item.job?.print_config_uuid),
          ),
          loginUuid
        )
      );

      failedCount++;
    }

    reportKitchenProgress(
      input,
      items.length,
      successCount,
      failedCount,
      skippedCount
    );

  }

  for (const batchGroup of groupKitchenBatchItems(batchItems)) {
    try {
      await printBatchWithLocalAgent(
        batchGroup.map((item) => item.job as PrintJob),
        undefined,
        cutMode
      );

      if (options.ack) {
        for (const item of batchGroup) {
          if (!item.ack_success_payload) continue;

          await ackPrintJob(
            ackPayloadWithLogin(item.ack_success_payload, loginUuid)
          );

          successCount++;
        }
      } else {
        successCount += batchGroup.length;
      }
    } catch (error) {
      lastErrorMessage = getPrinterErrorMessage(error);
      for (const item of batchGroup) {
        if (!options.ack || !item.ack_failed_payload) {
          failedCount++;
          continue;
        }

        await ackPrintJob(
          ackPayloadWithLogin(
            failPayload(
              item.ack_failed_payload,
              lastErrorMessage,
              getPrinterDeliveryState(error),
              textValue(item.job?.print_config_uuid),
            ),
            loginUuid
          )
        );

        failedCount++;
      }
    }

    reportKitchenProgress(
      input,
      items.length,
      successCount,
      failedCount,
      skippedCount
    );

  }

  input.onProgress?.({
    total: items.length,
    completed: items.length,
    successCount,
    failedCount,
    phase: "done",
  });

  return {
    successCount,
    failedCount,
    total: items.length,
    ...(failedCount > 0 && lastErrorMessage ? { errorMessage: lastErrorMessage } : {}),
  };
}

export async function executeKitchenPrintJobs(input: ExecuteKitchenPrintInput): Promise<KitchenPrintResult> {
  const jobUuid = textValue(
    input.pending_query?.print_job_uuid ?? input.print_job?.print_job_uuid
  );
  if (!jobUuid) return executePrintJobs(input, { ack: true, idempotent: true });

  const existing = kitchenExecutions.get(jobUuid);
  if (existing) return existing;

  const execution = executePrintJobs(input, { ack: true, idempotent: true });
  kitchenExecutions.set(jobUuid, execution);
  const cleanup = () => {
    if (kitchenExecutions.get(jobUuid) === execution) {
      kitchenExecutions.delete(jobUuid);
    }
  };
  void execution.then(cleanup, cleanup);
  return execution;
}

export async function executeInvoicePrintJobs(input: ExecuteInvoicePrintInput): Promise<KitchenPrintResult> {
  return executePrintJobs(input, { ack: false });
}

export async function executeReportPrintJobs(input: ExecuteReportPrintInput): Promise<KitchenPrintResult> {
  return executePrintJobs(input, { ack: true });
}
