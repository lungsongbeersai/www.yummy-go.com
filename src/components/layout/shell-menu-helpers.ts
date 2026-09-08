import type { MenuItem } from "@/config/menu";
import type { AuthUser } from "@/stores/auth-store";
import { isOfflineAllowedPath } from "@/lib/offline-routes";

const FIXED_DATA_SCREEN_PATHS = new Set([
  "/printers",
  "/package",
  "/products",
  "/stock",
  "/sales/cancel-history",
  "/sales/cancel-sale",
  "/sales/sales-list",
]);
const FIXED_DATA_SCREEN_PREFIXES = ["/settings/", "/report/"] as const;
const IMMERSIVE_SCREEN_PATHS = new Set(["/pos/tables", "/pos/order"]);

export function menuKey(title: string) {
  return `nav.${title}`;
}

export function menuItemLabel(
  item: Pick<MenuItem, "label" | "title">,
  t: (key: string) => string,
) {
  return item.label || t(menuKey(item.title));
}

export function routeIsActive(pathname: string, path?: string) {
  if (!path) return false;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function hasActiveRoute(item: MenuItem, pathname: string): boolean {
  if (routeIsActive(pathname, item.path)) return true;
  return (
    item.children?.some((child) => hasActiveRoute(child, pathname)) ?? false
  );
}

// คืนเฉพาะ title ของกลุ่มที่มีลูก เพราะผู้ใช้ค่าเดียวคือ openMenus ของ sidebar ซึ่งอ่านสถานะ
// กาง/หุบของกลุ่มเท่านั้น — leaf ไม่เคยถูกอ่าน ใส่เข้าไปได้แต่ทำให้ setOpenMenus ทำงานเปล่า ๆ ทุกครั้งที่เปลี่ยนหน้า
export function activeMenuTitles(items: MenuItem[], pathname: string): string[] {
  return items.flatMap((item) => {
    if (!item.children?.length || !hasActiveRoute(item, pathname)) return [];
    return [item.title, ...activeMenuTitles(item.children, pathname)];
  });
}

export function userInitials(user: AuthUser | null) {
  if (!user) return "YG";
  const source = user.store_name || user.branch_name || user.email || "YG";
  return (
    source
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "YG"
  );
}

export function isImmersiveScreen(pathname: string) {
  return IMMERSIVE_SCREEN_PATHS.has(pathname);
}

// เขียนทับ offlineLocked สดตามสถานะออฟไลน์ปัจจุบัน — ไม่แตะ disabled เดิม (ความหมายคนละอย่าง:
// disabled = ฟีเจอร์ยังไม่เปิดใช้งานถาวร, offlineLocked = ล็อกชั่วคราวตอนไม่มีเน็ต)
export function applyOfflineLock(
  items: MenuItem[],
  offline: boolean,
  isAndroidNative: boolean,
): MenuItem[] {
  if (!offline) return items;
  return items.map((item) => ({
    ...item,
    offlineLocked: Boolean(item.path) && !isOfflineAllowedPath(item.path!, isAndroidNative),
    children: item.children
      ? applyOfflineLock(item.children, offline, isAndroidNative)
      : item.children,
  }));
}

// หา path หน้าแรกที่ผู้ใช้เข้าได้จริงตามลำดับเมนู (บวก children ก่อน ไม่ใช้ path ของกลุ่ม dropdown เอง
// เพราะ shell-sidebar-menu.tsx เองก็ไม่ปล่อยให้กดกลุ่มนั้นตรง ๆ) — ใช้เลือกปลายทาง login แทนค่า "/" ตายตัว
export function firstNavigablePath(items: MenuItem[]): string | undefined {
  for (const item of items) {
    if (item.disabled) continue;
    if (item.children?.length) {
      const childPath = firstNavigablePath(item.children);
      if (childPath) return childPath;
      continue;
    }
    if (item.path) return item.path;
  }
  return undefined;
}

// เช็คว่าเมนูที่สิทธิ์ผู้ใช้เปิดจริง (จาก permission API) มี path ตรงกับ targetPath ไหม (exact match
// เท่านั้น ไม่ใช่ prefix แบบ routeIsActive) — ใช้เฉพาะ "/" ตอนนี้ เพื่อให้ Dashboard เช็คตัวเองได้ว่า
// ถูกตั้งสิทธิ์ให้เข้าดูจริงไหม (Dashboard ก็เป็นแค่ MenuItem ตัวหนึ่งที่แอดมินเลือกให้สิทธิ์ได้เหมือนเมนูอื่น)
export function menuGrantsPath(items: MenuItem[], targetPath: string): boolean {
  return items.some(
    (item) =>
      item.path === targetPath ||
      (item.children?.length ? menuGrantsPath(item.children, targetPath) : false),
  );
}

export function isFixedDataScreen(pathname: string) {
  return (
    isImmersiveScreen(pathname) ||
    FIXED_DATA_SCREEN_PATHS.has(pathname) ||
    FIXED_DATA_SCREEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
