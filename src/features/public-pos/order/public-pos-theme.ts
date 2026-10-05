import { useSyncExternalStore } from "react";

// ธีมของหน้าเมนู QR (ลูกค้า) — แยกจากธีมของแอป POS (useAppStore().theme ที่ใส่ .dark ที่ <html>)
// เพราะเครื่องเดียวกันอาจเปิดทั้ง POS ของแคชเชียร์และหน้าเมนู: สลับธีมเมนูต้องไม่ไปเปลี่ยนหน้า POS
// ค่าเริ่มต้นสว่าง (เจ้าของร้านเลือกไว้) ลูกค้ากดปุ่มในหัวเมนูเพื่อเปลี่ยน จำไว้ในเครื่อง
// แพตเทิร์นเดียวกับ public-pos-accent: external store ให้ useSyncExternalStore อ่านโดยไม่ต้อง setState ใน effect

export type PublicPosTheme = "light" | "dark";

export const DEFAULT_PUBLIC_POS_THEME: PublicPosTheme = "light";
const PUBLIC_POS_THEME_STORAGE_KEY = "yummy-go:public-pos-theme";

export function readPublicPosTheme(): PublicPosTheme {
  if (typeof window === "undefined") return DEFAULT_PUBLIC_POS_THEME;

  try {
    return window.localStorage.getItem(PUBLIC_POS_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return DEFAULT_PUBLIC_POS_THEME;
  }
}

const publicPosThemeListeners = new Set<() => void>();

export function subscribePublicPosTheme(listener: () => void) {
  publicPosThemeListeners.add(listener);
  return () => {
    publicPosThemeListeners.delete(listener);
  };
}

export function writePublicPosTheme(theme: PublicPosTheme) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PUBLIC_POS_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore localStorage failures in private or restricted browser contexts.
  }

  publicPosThemeListeners.forEach((listener) => listener());
}

/** ธีมเมนูปัจจุบัน — server render ใช้ค่าเริ่มต้นเสมอ ฝั่ง client sync จาก localStorage */
export function usePublicPosTheme(): PublicPosTheme {
  return useSyncExternalStore(subscribePublicPosTheme, readPublicPosTheme, () => DEFAULT_PUBLIC_POS_THEME);
}
