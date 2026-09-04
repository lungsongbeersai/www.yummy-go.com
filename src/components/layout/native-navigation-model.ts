import type { MenuItem } from "@/config/menu";
import { routeIsActive } from "./shell-menu-helpers";

// iOS HIG และ Material แนะนำ 3-5 ปลายทาง; 3 ทำให้ label ภาษาลาวยาว ๆ ไม่ถูกบีบบนจอแคบ
// (bottom nav แนวนอนของมือถือ ความกว้างจำกัด) — side rail (iPad/tablet) เลิกใช้ count จำกัด
// แบบนี้แล้ว เปลี่ยนไปโชว์ menuItems เต็มต้นไม้ผ่าน AppSidebar ตัวเดียวกับเว็บเดสก์ท็อปแทน
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
  | { path: string; type: "navigate" }
  | { type: "history-back" }
  | { type: "minimize" };

export interface AndroidBackInput {
  canGoBack: boolean;
  model: NativeNavigationModel;
  pathname: string;
}

// กลุ่มอย่าง "ขาย" มี menu_path เป็น /sale ซึ่งไม่มีหน้าจริง — ยิงไปลูกตัวแรกที่กดได้แทน
export function destinationPath(item: MenuItem): string | undefined {
  const child = item.children?.find(
    (entry) => !entry.disabled && !entry.offlineLocked && entry.path,
  );
  if (child?.path) return child.path;
  if (item.disabled || item.offlineLocked) return undefined;
  return item.path;
}

// เมนู "เปิดขาย" (/sale) เป็น dropdown ที่ direct ไปหาลูกตัวแรก (/sales/open-table-sale)
// เท่านั้นตาม destinationPath ด้านบน — ลูกตัวอื่น (/sales/sales-list) เลยเข้าไม่ถึงเลย
// ทั้งไม่มี dropdown UI ให้กด (bypass ไปแล้ว) และไม่ติดไป more เพราะทั้งก้อนกลายเป็น
// direct item เดียวไปแล้ว inject รายการนี้กลับเข้า more เอง ต่อท้าย "ยกเลิกบิลขาย"
// (/sales/cancel-sale) ตามที่ตกลงไว้ — เฉพาะ native model นี้ (ใช้แค่ฝั่ง Capacitor
// เท่านั้น เว็บยังกาง dropdown ปกติผ่าน AppSidebar ไม่ได้ bypass แบบนี้)
const NATIVE_INJECTED_SALES_LIST_PATH = "/sales/sales-list";
const NATIVE_INJECTED_SALES_LIST_ANCHOR_PATH = "/sales/cancel-sale";
const NATIVE_INJECTED_SALES_LIST_ITEM: MenuItem = {
  iconName: "clipboard-list",
  label: "ລາຍການຂາຍ",
  path: NATIVE_INJECTED_SALES_LIST_PATH,
  title: "native-injected-sales-list",
};

export function buildNativeNavigationModel(
  items: MenuItem[],
  directCount: number = NATIVE_DIRECT_DESTINATION_COUNT,
): NativeNavigationModel {
  const direct: NativeDestination[] = [];
  const more: MenuItem[] = [];

  for (const item of items) {
    if (item.is_header) continue;
    const path = destinationPath(item);
    // ไม่เลื่อนรายการที่กดไม่ได้ขึ้นมากินช่อง และไม่โชว์ placeholder ที่ disabled
    if (path && direct.length < directCount) {
      direct.push({ item, path });
      continue;
    }
    more.push(item);
  }

  // เมนูจริงจาก permission API มีกลุ่ม "/cancel" (ยกเลิกบิลขาย) แยกเป็นของตัวเอง —
  // /sales/cancel-sale เลยเป็นลูกอยู่ใน children ของกลุ่มนั้น ไม่ใช่ top-level item ตรง ๆ
  // ใน more ต้องเช็คทั้งสองแบบ ไม่งั้น anchorIndex หาไม่เจอเลยและ inject ไม่ทำงานจริง
  const matchesAnchor = (item: MenuItem) =>
    item.path === NATIVE_INJECTED_SALES_LIST_ANCHOR_PATH ||
    Boolean(
      item.children?.some(
        (child) => child.path === NATIVE_INJECTED_SALES_LIST_ANCHOR_PATH,
      ),
    );
  const matchesInjectedPath = (item: MenuItem) =>
    item.path === NATIVE_INJECTED_SALES_LIST_PATH ||
    Boolean(
      item.children?.some(
        (child) => child.path === NATIVE_INJECTED_SALES_LIST_PATH,
      ),
    );

  const anchorIndex = more.findIndex(matchesAnchor);
  const alreadyReachable = more.some(matchesInjectedPath);
  if (anchorIndex !== -1 && !alreadyReachable) {
    more.splice(anchorIndex + 1, 0, NATIVE_INJECTED_SALES_LIST_ITEM);
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
