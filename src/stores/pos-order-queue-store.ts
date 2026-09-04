"use client";

import { create } from "zustand";
import { optionalString } from "@/lib/values";
import * as posService from "@/services/pos";
import {
  type ConfirmToKitchenPendingQuery,
  type ConfirmToKitchenPrintJob,
  OrderItemStatus,
  type OrderItemStatus as OrderItemStatusType,
  type OrderQueueItem,
  type OrderQueueSectionSummary,
  type SendToKitchenResponse
} from "@/services/pos";
import {
  executeInvoicePrintJobs,
  executeKitchenPrintJobs,
  type KitchenPrintResult
} from "@/services/printer";
import { resolvePosPrinterContext } from "@/stores/pos-store/printer-context";
import {
  createSessionGuard,
  registerSessionStoreReset
} from "@/stores/session-store-registry";
import {
  errorMessage,
  type AsyncSlice
} from "@/stores/store-utils";

interface LoadParams {
  branch_uuid_fk: string;
  lang?: string;
  // Silent refresh: keep the current queue on screen instead of flashing the
  // loading state. Used when the transport verdict flips online<->offline.
  background?: boolean;
}

interface SendToKitchenParams {
  order_item_uuids: string[];
  branch_uuid_fk: string;
  login_uuid_fk: string;
  lang?: string;
}

interface ConfirmServedParams {
  order_item_uuids: string[];
  branch_uuid_fk: string;
  lang?: string;
}

interface CancelOrderItemsParams {
  order_item_uuids: string[];
  branch_uuid_fk: string;
  login_uuid_fk: string;
  cancel_reason: string;
  lang?: string;
  onProgress?: (completed: number, total: number) => void;
}

interface PosOrderQueueState extends AsyncSlice {
  status: OrderItemStatusType;
  items: OrderQueueItem[];
  sections: OrderQueueSectionSummary[];
  total: number;
  /** เวลาที่ได้ open_minutes ชุดนี้มา ใช้เป็นจุดอ้างอิงให้ตัวนับเวลารอเดินต่อเองฝั่ง client */
  loadedAt: number;

  setStatus: (status: OrderItemStatusType) => void;

  load: (params: LoadParams) => Promise<void>;

  sendToKitchen: (
    params: SendToKitchenParams
  ) => Promise<KitchenPrintResult | null>;

  confirmServed: (
    params: ConfirmServedParams
  ) => Promise<void>;

  cancelOrderItems: (
    params: CancelOrderItemsParams
  ) => Promise<void>;

  reset: () => void;
}

const initialState = {
  status:
    OrderItemStatus.WAITING_CONFIRM as OrderItemStatusType,

  items: [] as OrderQueueItem[],

  sections: [] as OrderQueueSectionSummary[],

  total: 0,

  loadedAt: 0,

  loading: false,

  saving: false,

  error: null as string | null
};

interface KitchenPrintRequest {
  pending_query?: ConfirmToKitchenPendingQuery;
  print_job?: ConfirmToKitchenPrintJob;
}

export function kitchenPrintRequests(
  response: SendToKitchenResponse
): KitchenPrintRequest[] {
  const requests = new Map<string, KitchenPrintRequest>();
  const printJobs = response.print_jobs?.length
    ? response.print_jobs
    : response.print_job
      ? [response.print_job]
      : [];
  const pendingQueries = response.pending_queries?.length
    ? response.pending_queries
    : response.pending_query
      ? [response.pending_query]
      : [];

  for (const printJob of printJobs) {
    const printJobUuid = optionalString(printJob.print_job_uuid);
    if (printJobUuid) {
      requests.set(printJobUuid, { print_job: printJob });
    }
  }

  for (const pendingQuery of pendingQueries) {
    const printJobUuid = optionalString(pendingQuery.print_job_uuid);
    if (!printJobUuid) continue;
    requests.set(printJobUuid, {
      ...requests.get(printJobUuid),
      pending_query: pendingQuery
    });
  }

  return [...requests.values()];
}

export function aggregateKitchenPrintResults(
  results: KitchenPrintResult[]
): KitchenPrintResult | null {
  if (!results.length) return null;

  const errorMessages = [
    ...new Set(results.map((result) => result.errorMessage).filter(Boolean))
  ];

  return {
    successCount: results.reduce(
      (total, result) => total + result.successCount,
      0
    ),
    failedCount: results.reduce(
      (total, result) => total + result.failedCount,
      0
    ),
    total: results.reduce((total, result) => total + result.total, 0),
    ...(results.some((result) => result.pending) ? { pending: true } : {}),
    ...(errorMessages.length ? { errorMessage: errorMessages.join(", ") } : {})
  };
}

export const usePosOrderQueueStore =
  create<PosOrderQueueState>((set, get) => ({
    ...initialState,

    setStatus: (status) =>
      set({
        status,
        items: [],
        total: 0,
        loading: true
      }),

    load: async (params) => {
      if (!params.branch_uuid_fk) {
        return;
      }

      const isCurrentSession =
        createSessionGuard();

      if (!params.background) {
        set({
          loading: true,
          error: null
        });
      }

      try {
        const status = get().status;

        const response =
          await posService.fetchOrderQueue({
            branch_uuid_fk:
              params.branch_uuid_fk,

            status,

            lang: params.lang
          });

        const section =
          posService.findOrderQueueSection(
            response,
            status
          );

        if (isCurrentSession()) {
          const items = posService.sortOrderQueueItems(
            section?.items ?? []
          );

          set({
            items,
            sections: posService.summarizeOrderQueueSections(response),
            total: section?.total ?? items.length,
            loadedAt: Date.now(),
            loading: false
          });
        }
      } catch (error) {
        if (isCurrentSession()) {
          set({
            error: errorMessage(error),
            loading: false
          });
        }

        throw error;
      }
    },

    sendToKitchen: async (params) => {
      if (!params.order_item_uuids.length) {
        return null;
      }

      const isCurrentSession =
        createSessionGuard();

      set({
        saving: true,
        error: null
      });

      try {
        const printer =
          await resolvePosPrinterContext({
            login_uuid_fk:
              params.login_uuid_fk,

            lang: params.lang
          });

        const response =
          await posService.sendToKitchen({
            order_item_uuids:
              params.order_item_uuids,

            device_code:
              printer.device_code,

            agent_id:
              printer.agent_id,

            print_mode:
              printer.print_mode,

            lang: params.lang
          });

        // A checkbox batch can span several orders. Process every backend job
        // sequentially so no physical ticket is omitted or interleaved.
        const printResults: KitchenPrintResult[] = [];
        for (const request of kitchenPrintRequests(response)) {
          const loginUuid = optionalString(
            request.pending_query?.login_uuid_fk,
            request.print_job?.login_uuid_fk,
            response.login_uuid_fk,
            params.login_uuid_fk
          );

          const result = await executeKitchenPrintJobs({
            print_job: request.print_job,
            pending_query: request.pending_query,
            login_uuid_fk: loginUuid ?? undefined,
            device_code: printer.device_code,
            agent_id: printer.agent_id,
            print_mode: printer.print_mode
          }).catch((error) => {
            console.error("[pos-order-queue] kitchen print failed", error);
            return {
              successCount: 0,
              failedCount: 1,
              total: 1,
              errorMessage: errorMessage(error)
            };
          });
          printResults.push(result);
        }

        if (response.print_queue_errors?.length) {
          printResults.push({
            successCount: 0,
            failedCount: response.print_queue_errors.length,
            total: response.print_queue_errors.length,
            errorMessage: response.print_queue_errors
              .map((item) => item.message)
              .filter(Boolean)
              .join(", ")
          });
        }

        const printResult = aggregateKitchenPrintResults(printResults);

        if (isCurrentSession()) {
          set({
            saving: false
          });
        }

        // background: true — ไม่งั้น loading:true จะเด้งเข้ามาแทนที่ตาราง/การ์ดทั้งหน้าด้วย
        // skeleton ทุกครั้งหลังกดปุ่ม (เห็นเป็นจอกระพริบ) ทั้งที่ข้อมูลเดิมยังใช้ได้ระหว่างรอโหลดใหม่
        await get().load({
          branch_uuid_fk:
            params.branch_uuid_fk,

          lang: params.lang,

          background: true
        });

        return printResult;
      } catch (error) {
        if (isCurrentSession()) {
          set({
            error: errorMessage(error),
            saving: false
          });
        }

        throw error;
      }
    },

    confirmServed: async (params) => {
      if (!params.order_item_uuids.length) {
        return;
      }

      const isCurrentSession =
        createSessionGuard();

      set({
        saving: true,
        error: null
      });

      try {
        await posService.confirmOrderItemsServed({
          order_item_uuids:
            params.order_item_uuids,

          lang: params.lang
        });

        if (isCurrentSession()) {
          set({
            saving: false
          });
        }

        // background: true — เหตุผลเดียวกับใน sendToKitchen ด้านบน กันจอกระพริบหลังกดปุ่ม
        await get().load({
          branch_uuid_fk:
            params.branch_uuid_fk,

          lang: params.lang,

          background: true
        });
      } catch (error) {
        if (isCurrentSession()) {
          set({
            error: errorMessage(error),
            saving: false
          });
        }

        throw error;
      }
    },

    cancelOrderItems: async (params) => {
      if (!params.order_item_uuids.length) {
        return;
      }

      const isCurrentSession =
        createSessionGuard();

      set({
        saving: true,
        error: null
      });

      try {
        const printer =
          await resolvePosPrinterContext({
            login_uuid_fk:
              params.login_uuid_fk,

            lang: params.lang
          });

        /*
         * Cancel one item at a time.
         *
         * Each cancellation can generate
         * its own receipt print job, so
         * parallel execution can conflict
         * on the same printer agent.
         */
        const total =
          params.order_item_uuids.length;

        for (
          let index = 0;
          index < total;
          index++
        ) {
          const orderItemUuid =
            params.order_item_uuids[index];

          const response =
            await posService.cancelOrderItem({
              order_it_uuid:
                orderItemUuid,

              login_uuid_fk:
                params.login_uuid_fk,

              device_code:
                printer.device_code,

              agent_id:
                printer.agent_id,

              print_mode:
                printer.print_mode,

              cancel_reason:
                params.cancel_reason,

              lang: params.lang
            });

          /*
           * Cancellation state is already
           * updated by backend.
           *
           * Receipt printing is secondary.
           * Print failure must not stop
           * the remaining cancellations.
           */
          const printJobUuid =
            optionalString(
              response.print_job
                ?.print_job_uuid,

              response.pending_query
                ?.print_job_uuid
            );

          if (printJobUuid) {
            const loginUuid =
              optionalString(
                response.pending_query
                  ?.login_uuid_fk,

                params.login_uuid_fk
              );

            await executeInvoicePrintJobs({
              print_job:
                response.print_job,

              pending_query:
                response.pending_query,

              login_uuid_fk:
                loginUuid ?? undefined,

              device_code:
                printer.device_code,

              agent_id:
                printer.agent_id,

              print_mode:
                printer.print_mode
            }).catch((error) => {
              console.error(
                "[pos-order-queue] cancel receipt print failed",
                error
              );
            });
          }

          params.onProgress?.(
            index + 1,
            total
          );
        }

        if (isCurrentSession()) {
          set({
            saving: false
          });
        }

        // background: true — เหตุผลเดียวกับใน sendToKitchen ด้านบน กันจอกระพริบหลังกดปุ่ม
        await get().load({
          branch_uuid_fk:
            params.branch_uuid_fk,

          lang: params.lang,

          background: true
        });
      } catch (error) {
        if (isCurrentSession()) {
          set({
            error: errorMessage(error),
            saving: false
          });
        }

        throw error;
      }
    },

    reset: () =>
      set({
        ...initialState
      })
  }));

registerSessionStoreReset(
  "pos-order-queue-store",
  () =>
    usePosOrderQueueStore
      .getState()
      .reset()
);
