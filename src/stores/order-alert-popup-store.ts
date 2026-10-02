"use client";

import { create } from "zustand";
import type { OrderAlertEntry } from "@/lib/pos/order-alerts";

interface OrderAlertPopupState {
  alerts: OrderAlertEntry[];
  show: (alert: OrderAlertEntry) => void;
  dismiss: () => void;
  clear: () => void;
}

export const useOrderAlertPopupStore = create<OrderAlertPopupState>((set) => ({
  alerts: [],
  show: (alert) => set((state) => ({
    alerts: state.alerts.some((entry) => entry.tableUuid === alert.tableUuid)
      ? state.alerts
      : [...state.alerts, alert],
  })),
  dismiss: () => set((state) => ({ alerts: state.alerts.slice(1) })),
  clear: () => set({ alerts: [] }),
}));
