"use client";

import { toast as sonnerToast } from "sonner";
import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
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
  info: sonnerToast.info
} as const;

export const useToastStore = create<ToastState>(() => ({
  show: ({ title, description, tone }) => {
    const fn = toneToToast[tone] ?? sonnerToast;
    fn(title, description ? { description } : undefined);
  }
}));
