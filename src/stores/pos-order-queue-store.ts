"use client";

import { create } from "zustand";
import * as posService from "@/services/pos";
import {
  OrderItemStatus,
  type OrderItemStatus as OrderItemStatusType,
  type OrderQueueItem
} from "@/services/pos";
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
        set({
          items: result.data ?? [],
          total: result.total ?? 0,
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

      await posService.sendToKitchen({
        order_item_uuids: params.order_item_uuids,
        device_code: printer.device_code,
        agent_id: printer.agent_id,
        print_mode: printer.print_mode,
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