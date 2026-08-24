"use client";

import { create } from "zustand";
import { optionalString } from "@/lib/values";
import * as posService from "@/services/pos";
import {
  OrderItemStatus,
  type OrderItemStatus as OrderItemStatusType,
  type OrderQueueRow
} from "@/services/pos";
import { executeInvoicePrintJobs, executeKitchenPrintJobs } from "@/services/printer";
import { resolvePosPrinterContext } from "@/stores/pos-store/printer-context";
import {
  createSessionGuard,
  registerSessionStoreReset
} from "@/stores/session-store-registry";
import { errorMessage, type AsyncSlice } from "@/stores/store-utils";

interface LoadParams {
  branch_uuid_fk: string;
  lang?: string;
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
  // เรียกหลังยกเลิกแต่ละรายการสำเร็จ (ก่อนพิมพ์ใบเสร็จของรายการนั้น) — ให้ UI แสดง progress
  // "กำลังยกเลิก x/N" ระหว่างประมวลผลทีละรายการ
  onProgress?: (completed: number, total: number) => void;
}

interface PosOrderQueueState extends AsyncSlice {
  status: OrderItemStatusType;
  items: OrderQueueRow[];
  total: number;
  setStatus: (status: OrderItemStatusType) => void;
  load: (params: LoadParams) => Promise<void>;
  sendToKitchen: (params: SendToKitchenParams) => Promise<void>;
  confirmServed: (params: ConfirmServedParams) => Promise<void>;
  cancelOrderItems: (params: CancelOrderItemsParams) => Promise<void>;
  reset: () => void;
}

const initialState = {
  status: OrderItemStatus.WAITING_CONFIRM as OrderItemStatusType,
  items: [] as OrderQueueRow[],
  total: 0,
  loading: false,
  saving: false,
  error: null as string | null
};

export const usePosOrderQueueStore = create<PosOrderQueueState>((set, get) => ({
  ...initialState,

  setStatus: (status) => set({ status, items: [], total: 0 }),

  load: async (params) => {
    if (!params.branch_uuid_fk) return;

    const isCurrentSession = createSessionGuard();

    set({ loading: true, error: null });

    try {
      const status = get().status;
      // endpoint คืนทุก section (ทุกสถานะ) มาพร้อมกันเสมอ ไม่ filter ตาม query `status` ให้ —
      // ต้องหา section ที่ตรงกับ tab ปัจจุบันแล้ว flatten orders[].items[] เอาเอง
      const response = await posService.fetchOrderQueue({
        branch_uuid_fk: params.branch_uuid_fk,
        status,
        lang: params.lang
      });
      const section = posService.findOrderQueueSection(response, status);

      if (isCurrentSession()) {
        set({
          items: posService.flattenOrderQueueSection(section),
          total: section?.total ?? 0,
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
    if (!params.order_item_uuids.length) return;

    const isCurrentSession = createSessionGuard();

    set({
      saving: true,
      error: null
    });

    try {
      const printer = await resolvePosPrinterContext({
        login_uuid_fk: params.login_uuid_fk,
        lang: params.lang
      });

      const response = await posService.sendToKitchen({
        order_item_uuids: params.order_item_uuids,
        device_code: printer.device_code,
        agent_id: printer.agent_id,
        print_mode: printer.print_mode,
        lang: params.lang
      });

      // send_to_kitchen ยืนยันสถานะออเดอร์ให้แล้วตั้งแต่ตอน response กลับมา (เหมือน confirmToKitchen)
      // print_job_uuid ที่ได้มาต้องส่งเข้า pending → ack ต่อ ถึงจะสั่งพิมพ์ครัวจริง — พิมพ์พลาดไม่ถือว่า
      // ยืนยันออเดอร์ล้มเหลว จึงไม่ throw ทับ error ของ flow นี้ แค่ log ไว้
      const printJobUuid = optionalString(
        response.print_job?.print_job_uuid,
        response.pending_query?.print_job_uuid
      );

      if (printJobUuid) {
        const loginUuid = optionalString(
          response.pending_query?.login_uuid_fk,
          response.login_uuid_fk,
          params.login_uuid_fk
        );

        await executeKitchenPrintJobs({
          print_job: response.print_job,
          pending_query: response.pending_query,
          login_uuid_fk: loginUuid ?? undefined,
          device_code: printer.device_code,
          agent_id: printer.agent_id,
          print_mode: printer.print_mode
        }).catch((error) => {
          console.error("[pos-order-queue] kitchen print failed", error);
        });
      }

      if (isCurrentSession()) {
        set({ saving: false });
      }

      await get().load({
        branch_uuid_fk: params.branch_uuid_fk,
        lang: params.lang
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

  confirmServed: async (params) => {
    if (!params.order_item_uuids.length) return;

    const isCurrentSession = createSessionGuard();

    set({
      saving: true,
      error: null
    });

    try {
      await posService.confirmOrderItemsServed({
        order_item_uuids: params.order_item_uuids,
        lang: params.lang
      });

      if (isCurrentSession()) {
        set({ saving: false });
      }

      await get().load({
        branch_uuid_fk: params.branch_uuid_fk,
        lang: params.lang
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
    if (!params.order_item_uuids.length) return;

    const isCurrentSession = createSessionGuard();

    set({
      saving: true,
      error: null
    });

    try {
      const printer = await resolvePosPrinterContext({
        login_uuid_fk: params.login_uuid_fk,
        lang: params.lang
      });

      // ยกเลิกทีละรายการ (ไม่ใช่ Promise.all ยิงพร้อมกัน) — แต่ละรายการมี print job/pending
      // query ของตัวเองที่ต้องพิมพ์ใบเสร็จยกเลิกตามลำดับ ยิงพร้อมกันจะชนกันที่ agent เครื่องพิมพ์
      // เดียวกัน onProgress แจ้ง UI ทุกครั้งที่ยกเลิกรายการหนึ่งเสร็จ (ก่อนพิมพ์ของรายการนั้น)
      const total = params.order_item_uuids.length;
      for (let index = 0; index < total; index++) {
        const orderItUuid = params.order_item_uuids[index];
        const response = await posService.cancelOrderItem({
          order_it_uuid: orderItUuid,
          login_uuid_fk: params.login_uuid_fk,
          device_code: printer.device_code,
          agent_id: printer.agent_id,
          print_mode: printer.print_mode,
          cancel_reason: params.cancel_reason,
          lang: params.lang
        });

        // ใบเสร็จยกเลิก: ack:false (executeInvoicePrintJobs) เหมือน pos-store.ts cancelItem —
        // cancel_order_item ปิดสถานะไปแล้วตั้งแต่ตัว PATCH เอง พิมพ์พลาดจึงไม่ throw ทับ ไม่หยุด
        // ลูป แค่ log ไว้ (เหมือน sendToKitchen ด้านบน)
        const printJobUuid = optionalString(
          response.print_job?.print_job_uuid,
          response.pending_query?.print_job_uuid
        );

        if (printJobUuid) {
          const loginUuid = optionalString(
            response.pending_query?.login_uuid_fk,
            params.login_uuid_fk
          );

          await executeInvoicePrintJobs({
            print_job: response.print_job,
            pending_query: response.pending_query,
            login_uuid_fk: loginUuid ?? undefined,
            device_code: printer.device_code,
            agent_id: printer.agent_id,
            print_mode: printer.print_mode
          }).catch((error) => {
            console.error("[pos-order-queue] cancel receipt print failed", error);
          });
        }

        params.onProgress?.(index + 1, total);
      }

      if (isCurrentSession()) {
        set({ saving: false });
      }

      await get().load({
        branch_uuid_fk: params.branch_uuid_fk,
        lang: params.lang
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

  reset: () => set({ ...initialState })
}));

registerSessionStoreReset(
  "pos-order-queue-store",
  () => usePosOrderQueueStore.getState().reset()
);