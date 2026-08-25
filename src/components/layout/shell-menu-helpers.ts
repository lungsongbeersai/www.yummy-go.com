import type { MenuItem } from "@/config/menu";
import type { AuthUser } from "@/stores/auth-store";

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

export function activeMenuTitles(items: MenuItem[], pathname: string): string[] {
  return items.flatMap((item) => {
    if (!hasActiveRoute(item, pathname)) return [];
    if (!item.children?.length) return [item.title];
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

export function isFixedDataScreen(pathname: string) {
  return (
    isImmersiveScreen(pathname) ||
    FIXED_DATA_SCREEN_PATHS.has(pathname) ||
    FIXED_DATA_SCREEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
