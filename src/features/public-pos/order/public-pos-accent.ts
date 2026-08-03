import {
  DEFAULT_PUBLIC_POS_ACCENT,
  PUBLIC_POS_ACCENTS,
  PUBLIC_POS_ACCENT_STORAGE_KEY,
} from "@/features/public-pos/order/constants";
import type { PublicPosAccent } from "@/features/public-pos/order/types";

export function normalizePublicPosAccent(value: unknown): PublicPosAccent {
  return PUBLIC_POS_ACCENTS.includes(value as PublicPosAccent)
    ? (value as PublicPosAccent)
    : DEFAULT_PUBLIC_POS_ACCENT;
}

export function readPublicPosAccent(): PublicPosAccent {
  if (typeof window === "undefined") return DEFAULT_PUBLIC_POS_ACCENT;

  try {
    return normalizePublicPosAccent(
      window.localStorage.getItem(PUBLIC_POS_ACCENT_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_PUBLIC_POS_ACCENT;
  }
}

// external store สำหรับ useSyncExternalStore — แพตเทิร์นเดียวกับ product-layout-mode
// ให้ component อ่านค่าได้โดยไม่ต้อง setState ใน effect และอัปเดตทันทีเมื่อเขียนค่าใหม่
const publicPosAccentListeners = new Set<() => void>();

export function subscribePublicPosAccent(listener: () => void) {
  publicPosAccentListeners.add(listener);
  return () => {
    publicPosAccentListeners.delete(listener);
  };
}

export function writePublicPosAccent(accent: PublicPosAccent) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PUBLIC_POS_ACCENT_STORAGE_KEY,
      normalizePublicPosAccent(accent),
    );
  } catch {
    // Ignore localStorage failures in private or restricted browser contexts.
  }

  publicPosAccentListeners.forEach((listener) => listener());
}
