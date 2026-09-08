import type { MenuItem } from "@/config/menu";
import { routeIsActive } from "./shell-menu-helpers";

// iOS HIG และ Material แนะนำ 3-5 ปลายทาง; 3 ทำให้ label ภาษาลาวยาว ๆ ไม่ถูกบีบบนจอแคบ
// (bottom nav แนวนอนของมือถือ ความกว้างจำกัด) — side rail (iPad/tablet) เลิกใช้ count จำกัด
// แบบนี้แล้ว เปลี่ยนไปโชว์ menuItems เต็มต้นไม้ผ่าน AppSidebar ตัวเดียวกับเว็บเดสก์ท็อปแทน
export const NATIVE_DIRECT_DESTINATION_COUNT = 3;

// หน้าที่เข้าถึงได้จาก deep link ต้องมี parent ที่แน่นอน ไม่พึ่ง history อย่างเดียว
const BACK_FALLBACK_PATHS: Record<string, string> = {
  "/pos/order": "/pos/tables",
  "/pos/tables": "/",
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

export function buildNativeNavigationModel(
  items: MenuItem[],
  directCount: number = NATIVE_DIRECT_DESTINATION_COUNT,
): NativeNavigationModel {
  const direct: NativeDestination[] = [];
  const more: MenuItem[] = [];
  const usedMorePaths = new Set<string>();

  // path ที่เคยโผล่ใน more ไปแล้ว (ตัว item เองหรือลูกที่ดันเข้ามาแทนกลุ่มพ่อ) ข้ามไม่ให้ซ้ำ
  // — เฉพาะฝั่ง more เท่านั้น: direct ปล่อยให้ path ซ้ำกับตัวอื่นได้ตามจริง (ดูเหตุผลด้านล่าง)
  function pushToMore(candidate: MenuItem) {
    if (candidate.path && usedMorePaths.has(candidate.path)) return;
    if (candidate.path) usedMorePaths.add(candidate.path);
    more.push(candidate);
  }

  for (const item of items) {
    if (item.is_header) continue;
    const path = destinationPath(item);
    if (path && direct.length < directCount) {
      direct.push({ item, path });
      // เมนูจริงจาก backend ตั้งใจวางลิงก์ลัด (เช่น "ຂາຍ" → /pos/tables) คู่กับ dropdown
      // เต็มรูปแบบ (เช่น "ເປີດຂາຍ" ที่ children ตัวแรก resolve ไปหน้าเดียวกัน) ติดกันเป็น
      // รายการที่ 2-3 จริง — ไม่ใช่ข้อมูลซ้ำโดยไม่ตั้งใจ เดิมเคยกันด้วยการข้าม path ที่ใช้ไป
      // แล้วลง more แทน แต่นั่นไปเบียดลำดับ direct ให้ไม่ตรงกับ 3 อันดับแรกจริงของ backend/
      // desktop อีกที (อาการที่รายงานมา) ปล่อยให้ path ซ้ำกันได้ตามจริง แก้ปัญหา React key
      // ชนกันที่ต้นเหตุแทน (ใช้ item.title/menu_id เป็น key ใน nav-destination-button.tsx
      // ไม่ใช้ destination.path) โดยไม่ต้องเสียลำดับ
      //
      // path นี้อาจมาจาก bypass ไปหาลูกตัวแรก (ไม่ใช่ item.path เอง) แปลว่ากลุ่มทั้งก้อนถูก
      // เบียดไปเป็นไอคอน direct ตัวเดียว ลูกที่เหลือ (เช่น "รายการขาย" ใต้กลุ่ม "ขาย") จะ
      // เข้าไม่ถึงเลยถ้าปล่อยทิ้ง — ดันลูกที่เหลือ (ยกเว้นตัวที่กลายเป็น direct ไปแล้ว) เข้า
      // more ตรงตำแหน่งเดิมของกลุ่มแทน รักษาลำดับสัมพัทธ์เดิมไว้
      const isChildBypass = item.children?.some(
        (child) => destinationPath(child) === path,
      );
      if (isChildBypass) {
        const remainingChildren = item.children?.filter(
          (child) => destinationPath(child) !== path,
        );
        remainingChildren?.forEach(pushToMore);
      }
      continue;
    }
    pushToMore(item);
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
