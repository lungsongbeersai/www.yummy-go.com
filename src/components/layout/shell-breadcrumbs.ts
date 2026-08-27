import type { MenuItem } from "@/config/menu";
import {
  routeBreadcrumbs,
  type RouteBreadcrumbItem,
} from "@/config/route-breadcrumbs";

export type BreadcrumbTrailItem = RouteBreadcrumbItem;

// เมนู permission API ส่ง menu_path มาให้ทุกตัวแม้แต่กลุ่ม dropdown (เช่น /sale, /cancel, /report,
// /settings) แต่กลุ่มเหล่านี้ไม่มีหน้าเพจจริงของตัวเอง (หน้า hub /settings ถูกลบไปแล้ว เข้าถึงแต่ละ
// โมดูลตรง ๆ ผ่าน dropdown แทน) — breadcrumb ของกลุ่มพวกนี้เลยต้องเป็น label เฉย ๆ ไม่ใช่ลิงก์กดได้
export const NON_PAGE_GROUP_PATHS = new Set(["/sale", "/cancel", "/report", "/settings"]);

function breadcrumbPath(item: MenuItem) {
  return item.path && !NON_PAGE_GROUP_PATHS.has(item.path)
    ? item.path
    : undefined;
}

function findBreadcrumbs(
  items: MenuItem[],
  pathname: string,
  trail: BreadcrumbTrailItem[] = [],
): BreadcrumbTrailItem[] | null {
  for (const item of items) {
    if (item.is_header) continue;
    const nextTrail = [
      ...trail,
      {
        disabled: item.disabled,
        label: item.label,
        path: breadcrumbPath(item),
        title: item.title,
      },
    ];
    if (item.path && pathname === item.path) return nextTrail;
    if (item.children?.length) {
      const match = findBreadcrumbs(item.children, pathname, nextTrail);
      if (match) return match;
    }
  }
  return null;
}

export function resolveShellBreadcrumbs(
  items: MenuItem[],
  pathname: string,
): BreadcrumbTrailItem[] | null {
  const exact = findBreadcrumbs(items, pathname);
  if (exact) return exact;

  const routeTrail = routeBreadcrumbs[pathname];
  if (routeTrail) return routeTrail;

  const segments = pathname.split("/").filter(Boolean);
  for (let index = segments.length - 1; index > 0; index -= 1) {
    const ancestor = `/${segments.slice(0, index).join("/")}`;
    const match = findBreadcrumbs(items, ancestor);
    if (match) return match;
  }
  return null;
}
