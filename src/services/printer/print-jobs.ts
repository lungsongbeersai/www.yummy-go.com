// Pending print-job fetch/ack + kitchen/invoice print execution (P3.4 split
// of printer.ts). Depends on agent-transport.ts (dispatch to local agent) and
// config-api.ts (renderMobileEscpos) — the top of the printer/ import graph.
import axios from "axios";
import { apiRequest, ServiceError } from "@/lib/api";
import { Capacitor } from "@capacitor/core";
import { AGENT_URL } from "@/config/printer-agent";
import {
  AGENT_SECRET,
  agentBase as printerAgentBase,
  assertAgentOk,
  failPayload,
  getPrinterErrorMessage,
  textValue
} from "@/services/printer/helpers";
import {
  assertPrintJobForAgent,
  dispatchPrintJob,
  getLocalAgentInfo,
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
  KitchenPrintResult,
  PendingPrintItem,
  PendingPrintJobData,
  PendingPrintJobsFullResponse,
  PendingPrintJobsParams,
  PendingPrintJobsResult,
  PrintJob,
  PrintOpsBatchAgentResponse,
  PrintOpsBatchPayload
} from "@/services/printer/types";

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

  return (
    printClient === "mobile_wifi" ||
    printMode === "mobile_wifi" ||
    Boolean(textValue(batch.mobile_escpos?.escpos_base64))
  );
}

function printBatchJobTotal(batch: PrintOpsBatchPayload) {
  const jobsTotal = Array.isArray(batch.jobs) ? batch.jobs.length : 0;
  const declaredTotal = Number(batch.job_total || 0);

  return jobsTotal || declaredTotal || 0;
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

  const agentBase = printerAgentBase(
    AGENT_URL,
    textValue(batch.agent_url) || textValue(batch.jobs[0]?.agent_url) || undefined
  );
  const agent = await getLocalAgentInfo(agentBase);
  for (const job of batch.jobs) {
    assertPrintJobForAgent(job, agent);
  }

  const { data } = await axios.post<PrintOpsBatchAgentResponse>(`${agentBase}/print-ops-batch`, batch, {
    headers: { "x-agent-secret": AGENT_SECRET },
    timeout: 20000
  });
  assertAgentOk(data, "Print failed");
}

async function executePrintJobs(input: ExecuteKitchenPrintInput, options: { ack: boolean }): Promise<KitchenPrintResult> {
  const jobUuid = input.pending_query?.print_job_uuid ?? input.print_job?.print_job_uuid;
  const loginUuid = input.pending_query?.login_uuid_fk ?? input.login_uuid_fk;

  if (!jobUuid || !loginUuid) {
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

    input.onProgress?.({
      total,
      completed: 0,
      successCount: 0,
      failedCount: 0,
      phase: "printing",
    });

    try {
      for (const batch of batchPayloads) {
        if (isMobilePrintBatch(batch)) {
          await printKitchenMobileBatch(batch);
        } else {
          await printKitchenBatchJob(batch);
        }
      }
    } catch (error) {
      if (options.ack && globalAckFailed) {
        await ackPrintJob(
          ackPayloadWithLogin(
            failPayload(globalAckFailed, getPrinterErrorMessage(error)),
            loginUuid
          )
        ).catch(() => undefined);
      }

      input.onProgress?.({
        total,
        completed: total,
        successCount: 0,
        failedCount: total,
        phase: "done",
      });

      return {
        successCount: 0,
        failedCount: total,
        total,
        errorMessage: getPrinterErrorMessage(error),
      };
    }

    // พิมพ์เสร็จแล้ว (กระดาษออกแล้ว) — ถ้า ack "สำเร็จ" กลับ backend พลาด ไม่ถือเป็นการพิมพ์ล้มเหลว
    // สำคัญบนแอปมือถือ: เดิมพิมพ์ผ่านแต่ ack พลาด เลยถูกนับเป็น fail ทำให้แจ้งเตือนผิดว่ายืนยันออเดอร์ล้มเหลว
    if (options.ack && globalAckSuccess) {
      await ackPrintJob(
        ackPayloadWithLogin(globalAckSuccess, loginUuid)
      ).catch((error) => {
        console.error("[printer] kitchen print succeeded but success-ack failed", error);
      });
    }

    input.onProgress?.({
      total,
      completed: total,
      successCount: total,
      failedCount: 0,
      phase: "done",
    });

    return {
      successCount: total,
      failedCount: 0,
      total,
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

      await ackPrintJob(
        ackPayloadWithLogin(
          failPayload(item.ack_failed_payload, lastErrorMessage),
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
            failPayload(item.ack_failed_payload, lastErrorMessage),
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
  return executePrintJobs(input, { ack: true });
}

export async function executeInvoicePrintJobs(input: ExecuteInvoicePrintInput): Promise<KitchenPrintResult> {
  return executePrintJobs(input, { ack: false });
}
