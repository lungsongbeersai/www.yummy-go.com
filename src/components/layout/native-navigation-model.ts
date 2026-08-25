import type { MenuItem } from "@/config/menu";
import { routeIsActive } from "./shell-menu-helpers";

// iOS HIG และ Material แนะนำ 3-5 ปลายทาง; 3 ทำให้ label ภาษาลาวยาว ๆ ไม่ถูกบีบบนจอแคบ
export const NATIVE_DIRECT_DESTINATION_COUNT = 3;

// หน้าที่เข้าถึงได้จาก deep link ต้องมี parent ที่แน่นอน ไม่พึ่ง history อย่างเดียว
const BACK_FALLBACK_PATHS: Record<string, string> = {
  "/pos/order": "/pos/tables",
  "/printers/form": "/printers",
  "/products/form": "/products",
};

export interface NativeDestination {
  item: MenuItem;
  path: string;
}

export interface NativeNavigationModel {
  direct: NativeDestination[];
  more: MenuItem[];
}

export type AndroidBackAction =
  | { type: "close-overlay" }
  | { path: string; type: "navigate" }
  | { type: "history-back" }
  | { type: "minimize" };

export interface AndroidBackInput {
  canGoBack: boolean;
  model: NativeNavigationModel;
  overlayOpen: boolean;
  pathname: string;
}

// กลุ่มอย่าง "ขาย" มี menu_path เป็น /sale ซึ่งไม่มีหน้าจริง — ยิงไปลูกตัวแรกที่กดได้แทน
export function destinationPath(item: MenuItem): string | undefined {
  const child = item.children?.find((entry) => !entry.disabled && entry.path);
  if (child?.path) return child.path;
  if (item.disabled) return undefined;
  return item.path;
}

export function buildNativeNavigationModel(
  items: MenuItem[],
): NativeNavigationModel {
  const direct: NativeDestination[] = [];
  const more: MenuItem[] = [];

  for (const item of items) {
    if (item.is_header) continue;
    const path = destinationPath(item);
    // ไม่เลื่อนรายการที่กดไม่ได้ขึ้นมากินช่อง และไม่โชว์ placeholder ที่ disabled
    if (path && direct.length < NATIVE_DIRECT_DESTINATION_COUNT) {
      direct.push({ item, path });
      continue;
    }
    more.push(item);
  }

  return { direct, more };
}

export function isDestinationActive(
  destination: NativeDestination,
  pathname: string,
): boolean {
  if (routeIsActive(pathname, destination.path)) return true;
  const { item } = destination;
  if (item.children?.some((child) => routeIsActive(pathname, child.path))) {
    return true;
  }
  return routeIsActive(pathname, item.path);
}

export function backFallbackPath(pathname: string): string | undefined {
  return BACK_FALLBACK_PATHS[pathname];
}

export function shouldShowBackButton(
  model: NativeNavigationModel,
  pathname: string,
): boolean {
  if (backFallbackPath(pathname)) return true;
  return !model.direct.some((destination) =>
    isDestinationActive(destination, pathname),
  );
}

export function resolveAndroidBackAction({
  canGoBack,
  model,
  overlayOpen,
  pathname,
}: AndroidBackInput): AndroidBackAction {
  if (overlayOpen) return { type: "close-overlay" };

  const fallback = backFallbackPath(pathname);
  if (fallback) return { path: fallback, type: "navigate" };

  if (!shouldShowBackButton(model, pathname)) return { type: "minimize" };

  return canGoBack ? { type: "history-back" } : { type: "minimize" };
}
