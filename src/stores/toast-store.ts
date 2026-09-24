"use client";

import { toast as sonnerToast } from "sonner";
import { create } from "zustand";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastInput {
  action?: {
    label: string;
    onClick: () => void;
  };
  id?: string | number;
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
  show: ({ action, id, title, description, tone }) => {
    const fn = toneToToast[tone] ?? sonnerToast;
    fn(title, {
      ...(action ? { action } : {}),
      ...(description ? { description } : {}),
      ...(id !== undefined ? { id } : {}),
    });
  }
}));
