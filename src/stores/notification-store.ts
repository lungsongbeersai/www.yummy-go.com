"use client";

import { create } from "zustand";

export type NotificationTone = "info" | "success" | "warning";

export interface NotificationItem {
  id: string;
  titleKey: string;
  descriptionKey?: string;
  tone: NotificationTone;
  createdAt: number;
  read: boolean;
}

interface NotificationState {
  items: NotificationItem[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const MINUTE = 60_000;

function seed(): NotificationItem[] {
  const now = Date.now();
  return [
    {
      id: "notif-new-order",
      titleKey: "notifications.mock.newOrder.title",
      descriptionKey: "notifications.mock.newOrder.description",
      tone: "info",
      createdAt: now - 2 * MINUTE,
      read: false
    },
    {
      id: "notif-low-stock",
      titleKey: "notifications.mock.lowStock.title",
      descriptionKey: "notifications.mock.lowStock.description",
      tone: "warning",
      createdAt: now - 35 * MINUTE,
      read: false
    },
    {
      id: "notif-printer-offline",
      titleKey: "notifications.mock.printerOffline.title",
      descriptionKey: "notifications.mock.printerOffline.description",
      tone: "warning",
      createdAt: now - 4 * 60 * MINUTE,
      read: true
    },
    {
      id: "notif-welcome",
      titleKey: "notifications.mock.welcome.title",
      descriptionKey: "notifications.mock.welcome.description",
      tone: "success",
      createdAt: now - 26 * 60 * MINUTE,
      read: true
    }
  ];
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: seed(),
  markRead: (id) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, read: true } : item))
    })),
  markAllRead: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, read: true }))
    })),
  clear: () => set({ items: [] })
}));
