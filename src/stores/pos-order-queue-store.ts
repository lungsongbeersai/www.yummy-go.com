"use client";

import { create } from "zustand";
import * as posService from "@/services/pos";
import { OrderItemStatus, type OrderItemStatus as OrderItemStatusType, type OrderQueueItem } from "@/services/pos";
import { resolvePosPrinterContext } from "@/stores/pos-store/printer-context";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage, type AsyncSlice } from "@/stores/store-utils";

interface LoadParams {
  branch_uuid_fk: string;
  lang?: string;
}

interface SendToKitchenParams {
  order_uuids: string[];
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
}

interface PosOrderQueueState extends AsyncSlice {
  status: OrderItemStatusType;
  items: OrderQueueItem[];
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
  items: [] as OrderQueueItem[],
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
      const result = await posService.fetchOrderQueue({
        branch_uuid_fk: params.branch_uuid_fk,
        status: get().status,
        lang: params.lang
      });
      if (isCurrentSession()) {
        set({ items: result.data ?? [], total: result.total ?? 0, loading: false });
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loading: false });
    }
  },

  // เลือกได้ทีละ order_item ในตาราง แต่ API รับ order_uuids ระดับออเดอร์ — ผู้เรียก
  // (order-queue-page.tsx) dedupe order_uuid จาก row ที่ติ๊กไว้ก่อนส่งมาที่นี่
  sendToKitchen: async (params) => {
    if (!params.order_uuids.length) return;
    const isCurrentSession = createSessionGuard();

    set({ saving: true, error: null });
    try {
      const printer = await resolvePosPrinterContext({
        login_uuid_fk: params.login_uuid_fk,
        lang: params.lang
      });

      await posService.sendToKitchen({
        order_uuids: params.order_uuids,
        device_code: printer.device_code,
        agent_id: printer.agent_id,
        print_mode: printer.print_mode,
        lang: params.lang
      });

      if (isCurrentSession()) set({ saving: false });
      await get().load({ branch_uuid_fk: params.branch_uuid_fk, lang: params.lang });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },

  // 2 -> 4: ระดับ order_item ตรงๆ (API รับ order_item_uuids เป็น array อยู่แล้ว) ไม่ต้อง
  // resolve printer context เพราะ endpoint นี้ไม่พิมพ์ใบเสร็จ/ใบครัวใดๆ
  confirmServed: async (params) => {
    if (!params.order_item_uuids.length) return;
    const isCurrentSession = createSessionGuard();

    set({ saving: true, error: null });
    try {
      await posService.confirmOrderItemsServed({
        order_item_uuids: params.order_item_uuids,
        lang: params.lang
      });

      if (isCurrentSession()) set({ saving: false });
      await get().load({ branch_uuid_fk: params.branch_uuid_fk, lang: params.lang });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },

  // 4 -> 9: API cancel_order_item รับ order_it_uuid ทีละตัวเท่านั้น (ไม่มีเวอร์ชัน bulk)
  // จึงต้องยิงวนทีละแถวที่เลือกไว้ พร้อม printer context เดียวกับ send_to_kitchen เพราะ
  // endpoint นี้ก็พิมพ์ใบยกเลิกเหมือนกัน (มี device_code/agent_id/print_mode ใน payload)
  cancelOrderItems: async (params) => {
    if (!params.order_item_uuids.length) return;
    const isCurrentSession = createSessionGuard();

    set({ saving: true, error: null });
    try {
      const printer = await resolvePosPrinterContext({
        login_uuid_fk: params.login_uuid_fk,
        lang: params.lang
      });

      await Promise.all(
        params.order_item_uuids.map((order_it_uuid) =>
          posService.cancelOrderItem({
            order_it_uuid,
            device_code: printer.device_code,
            agent_id: printer.agent_id,
            print_mode: printer.print_mode,
            cancel_reason: params.cancel_reason,
            lang: params.lang
          })
        )
      );

      if (isCurrentSession()) set({ saving: false });
      await get().load({ branch_uuid_fk: params.branch_uuid_fk, lang: params.lang });
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },

  reset: () => set({ ...initialState })
}));

registerSessionStoreReset("pos-order-queue-store", () => usePosOrderQueueStore.getState().reset());
