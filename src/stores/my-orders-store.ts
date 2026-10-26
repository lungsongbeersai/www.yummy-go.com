"use client";

import { create } from "zustand";
import * as posService from "@/services/pos";
import type { CartOrder, PosZone } from "@/services/pos";
import { buildMyOrdersFromTables, type MyOrder } from "@/features/my-orders/my-orders-data";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage, type AsyncSlice } from "@/stores/store-utils";

interface MyOrdersState extends AsyncSlice {
  orders: MyOrder[];
  load: (params: { branchUuid: string; userId: string; lang: string }) => Promise<void>;
  reset: () => void;
}

function normalizeCartOrders(response: posService.FetchCartResponse): CartOrder[] {
  const value = response.orders ?? response.data;
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

async function fetchTableCarts(tables: Array<{ table_uuid: string }>, lang: string) {
  const results = new Map<string, CartOrder[]>();
  const batchSize = 6;
  for (let index = 0; index < tables.length; index += batchSize) {
    const batch = tables.slice(index, index + batchSize);
    const responses = await Promise.all(batch.map((table) =>
      posService.fetchCart({ table_uuid: table.table_uuid, lang }).then(normalizeCartOrders),
    ));
    batch.forEach((table, batchIndex) => results.set(table.table_uuid, responses[batchIndex]));
  }
  return results;
}

const initialState = { orders: [] as MyOrder[], loading: false, saving: false, error: null as string | null };
let loadVersion = 0;

export const useMyOrdersStore = create<MyOrdersState>((set) => ({
  ...initialState,
  load: async ({ branchUuid, userId, lang }) => {
    const isCurrentSession = createSessionGuard();
    const version = ++loadVersion;
    const isCurrentLoad = () => isCurrentSession() && version === loadVersion;
    set({ loading: true, error: null });
    try {
      const response = await posService.getPosTables({ branch_uuid_fk: branchUuid, lang });
      const zones: PosZone[] = response.data ?? [];
      const cartsByTable = await fetchTableCarts(
        zones.flatMap((zone) => (zone.tables ?? [])
          .filter((table) => table.table_status !== posService.TableStatus.AVAILABLE || table.customer_order_state)
          .map((table) => ({ table_uuid: table.table_uuid }))),
        lang,
      );
      if (isCurrentLoad()) set({ orders: buildMyOrdersFromTables(zones, cartsByTable, userId), loading: false });
    } catch (error) {
      if (isCurrentLoad()) set({ orders: [], error: errorMessage(error), loading: false });
    }
  },
  reset: () => {
    loadVersion += 1;
    set(initialState);
  },
}));

registerSessionStoreReset("my-orders", () => useMyOrdersStore.getState().reset());

