import type { MenuItem } from "@/config/menu";
import { mobileMenuItem } from "./mobile-menu";
import { routeIsActive } from "./shell-menu-helpers";

// iOS HIG และ Material แนะนำ 3-5 ปลายทาง; 3 ทำให้ label ภาษาลาวยาว ๆ ไม่ถูกบีบบนจอแคบ
// (bottom nav แนวนอนของมือถือ ความกว้างจำกัด) — side rail (iPad/tablet) เลิกใช้ count จำกัด
// แบบนี้แล้ว เปลี่ยนไปโชว์ menuItems เต็มต้นไม้ผ่าน AppSidebar ตัวเดียวกับเว็บเดสก์ท็อปแทน
export const NATIVE_DIRECT_DESTINATION_COUNT = 3;

// หน้าที่เข้าถึงได้จาก deep link ต้องมี parent ที่แน่นอน ไม่พึ่ง history อย่างเดียว
const BACK_FALLBACK_PATHS: Record<string, string> = {
  "/posAll/order": "/posAll/tables",
  "/posAll/tables": "/",
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
  | { path: string; type: "navigate" }
  | { type: "history-back" }
  | { type: "minimize" };

export interface AndroidBackInput {
  canGoBack: boolean;
  model: NativeNavigationModel;
  pathname: string;
}

// กลุ่มอย่าง "ขาย" มี menu_path เป็น /sale ซึ่งไม่มีหน้าจริง — ใช้ลูกตัวแรกที่กดได้
// เป็น representative path สำหรับ active/back; กลุ่มหลายรายการเปิดตัวเลือกตอนแตะ
export function destinationPath(item: MenuItem): string | undefined {
  if (item.disabled) return undefined;
  const child = item.children?.find(
    (entry) => !entry.disabled && !entry.is_header && entry.path,
  );
  if (child?.path) return child.path;
  return item.path;
}

export function buildNativeNavigationModel(
  items: MenuItem[],
  directCount: number = NATIVE_DIRECT_DESTINATION_COUNT,
): NativeNavigationModel {
  const direct: NativeDestination[] = [];
  const more: MenuItem[] = [];
  for (const sourceItem of items) {
    const item = mobileMenuItem(sourceItem);
    if (item.is_header) continue;
    const path = destinationPath(item);
    if (path && direct.length < directCount) {
      direct.push({ item, path });
      // Backend อาจวาง shortcut คู่กับกลุ่มที่มี representative path เดียวกัน
      // เก็บทั้งสองตามลำดับเดิมและใช้ item.title/menu_id เป็น React key แทน path
      // กลุ่มหลายรายการเปิด Drawer จากปุ่มนี้ได้แล้ว จึงเก็บลูกไว้ในกลุ่มเดิมทั้งหมด
      // ไม่ต้องสร้างแถวซ้ำใน More จากลูกที่เหลืออีก
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
  pathname,
}: AndroidBackInput): AndroidBackAction {
  const fallback = backFallbackPath(pathname);
  if (fallback) return { path: fallback, type: "navigate" };

  if (!shouldShowBackButton(model, pathname)) return { type: "minimize" };

  return canGoBack ? { type: "history-back" } : { type: "minimize" };
}
