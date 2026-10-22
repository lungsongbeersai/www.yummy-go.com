"use client";

import { toast as sonnerToast } from "sonner";
import { create } from "zustand";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastInput {
  action?: {
    label: string;
    onClick: (event: { preventDefault: () => void }) => void;
  };
  id?: string | number;
  duration?: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastState {
  show: (toast: ToastInput) => void;
}

const toneToToast = {
  success: sonnerToast.success,
  error: sonnerToast.error,
  warning: sonnerToast.warning,
  info: sonnerToast.info
} as const;

export const useToastStore = create<ToastState>(() => ({
  show: ({ action, id, duration, title, description, tone }) => {
    const fn = toneToToast[tone] ?? sonnerToast;
    fn(title, {
      // Sonner merges updates by ID; clear an old retry after printing succeeds.
      action: action ?? null,
      ...(description ? { description } : {}),
      ...(id !== undefined ? { id } : {}),
      ...(duration !== undefined ? { duration } : {}),
    });
  }
}));
