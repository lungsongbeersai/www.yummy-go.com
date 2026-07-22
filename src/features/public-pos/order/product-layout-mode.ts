import { PUBLIC_PRODUCT_LAYOUT_STORAGE_KEY } from "@/features/public-pos/order/constants";
import type { PublicProductLayoutMode } from "@/features/public-pos/order/types";

export function normalizePublicProductLayoutMode(
  value: unknown,
): PublicProductLayoutMode {
  return value === "list" ? "list" : "grid";
}

export function readPublicProductLayoutMode(): PublicProductLayoutMode {
  if (typeof window === "undefined") return "grid";

  try {
    return normalizePublicProductLayoutMode(
      window.localStorage.getItem(PUBLIC_PRODUCT_LAYOUT_STORAGE_KEY),
    );
  } catch {
    return "grid";
  }
}

// external store สำหรับ useSyncExternalStore — ให้ component อ่าน layout mode
// โดยไม่ต้อง setState ใน effect และอัปเดตทันทีเมื่อมีการเขียนค่าใหม่
const publicProductLayoutModeListeners = new Set<() => void>();

export function subscribePublicProductLayoutMode(listener: () => void) {
  publicProductLayoutModeListeners.add(listener);
  return () => {
    publicProductLayoutModeListeners.delete(listener);
  };
}

export function writePublicProductLayoutMode(mode: PublicProductLayoutMode) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PUBLIC_PRODUCT_LAYOUT_STORAGE_KEY,
      normalizePublicProductLayoutMode(mode),
    );
  } catch {
    // Ignore localStorage failures in private or restricted browser contexts.
  }

  publicProductLayoutModeListeners.forEach((listener) => listener());
}
