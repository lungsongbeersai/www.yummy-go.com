import {
  DEFAULT_PUBLIC_POS_HERO_VISIBLE,
  PUBLIC_POS_HERO_VISIBLE_STORAGE_KEY,
} from "@/features/public-pos/order/constants";

export function normalizePublicPosHeroVisible(value: unknown): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return DEFAULT_PUBLIC_POS_HERO_VISIBLE;
}

export function readPublicPosHeroVisible(): boolean {
  if (typeof window === "undefined") return DEFAULT_PUBLIC_POS_HERO_VISIBLE;

  try {
    return normalizePublicPosHeroVisible(
      window.localStorage.getItem(PUBLIC_POS_HERO_VISIBLE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_PUBLIC_POS_HERO_VISIBLE;
  }
}

// external store สำหรับ useSyncExternalStore — แพตเทิร์นเดียวกับ public-pos-accent.ts
// ให้ทั้ง Tweaks popover (เขียน) และ ProductBrowseContent (อ่านเพื่อ render) sync กันโดยไม่ต้อง prop-drill
const publicPosHeroVisibleListeners = new Set<() => void>();

export function subscribePublicPosHeroVisible(listener: () => void) {
  publicPosHeroVisibleListeners.add(listener);
  return () => {
    publicPosHeroVisibleListeners.delete(listener);
  };
}

export function writePublicPosHeroVisible(visible: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PUBLIC_POS_HERO_VISIBLE_STORAGE_KEY,
      String(visible),
    );
  } catch {
    // Ignore localStorage failures in private or restricted browser contexts.
  }

  publicPosHeroVisibleListeners.forEach((listener) => listener());
}
