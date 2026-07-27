import type { Route } from "next";
import type { MenuItem } from "@/config/menu";
import {
  routeBreadcrumbs,
  type RouteBreadcrumbItem,
} from "@/config/route-breadcrumbs";

export const SHELL_DESTINATION_IDS = [
  "dashboard",
  "tables",
  "pos",
  "reports",
  "more",
] as const;

export type ShellDestinationId = (typeof SHELL_DESTINATION_IDS)[number];
export type ShellDestinationAction = "reports" | "more";

export interface ShellDestinationState {
  active: boolean;
  action?: ShellDestinationAction;
  enabled: boolean;
  href?: Route;
  id: ShellDestinationId;
}

export interface ShellRouteMode {
  fixedContent: boolean;
  mobileBackHref: Route | null;
  posWorkspace: boolean;
}

const FIXED_DATA_SCREEN_PATHS = new Set([
  "/printers",
  "/products",
  "/stock",
  "/sales/cancel-history",
  "/sales/cancel-sale",
  "/sales/sales-list",
]);
const FIXED_DATA_SCREEN_PREFIXES = ["/settings/", "/report/"] as const;

function isAllowed(item: MenuItem, userStatus?: number) {
  if (!item.allowedStatus?.length) return true;
  return typeof userStatus === "number" && item.allowedStatus.includes(userStatus);
}

export function filterMenu(
  items: MenuItem[],
  userStatus?: number,
): MenuItem[] {
  return items.flatMap((item) => {
    if (!isAllowed(item, userStatus)) return [];
    if (!item.children?.length) return [item];
    return [{ ...item, children: filterMenu(item.children, userStatus) }];
  });
}

function isExactRoute(pathname: string, path?: string) {
  return Boolean(path && pathname === path);
}

export function routeIsActive(pathname: string, path?: string) {
  if (!path) return false;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function hasActiveRoute(item: MenuItem, pathname: string): boolean {
  if (routeIsActive(pathname, item.path)) return true;
  return item.children?.some((child) => hasActiveRoute(child, pathname)) ?? false;
}

export function activeMenuTitles(items: MenuItem[], pathname: string): string[] {
  return items.flatMap((item) => {
    if (!item.children?.length || !hasActiveRoute(item, pathname)) return [];
    return [item.title, ...activeMenuTitles(item.children, pathname)];
  });
}

function findBreadcrumbs(
  items: MenuItem[],
  pathname: string,
  trail: RouteBreadcrumbItem[] = [],
): RouteBreadcrumbItem[] | null {
  for (const item of items) {
    if (item.is_header) continue;
    const nextTrail = [
      ...trail,
      {
        disabled: item.disabled,
        label: item.label,
        path: item.children?.length ? undefined : item.path,
        title: item.title,
      },
    ];
    if (isExactRoute(pathname, item.path)) return nextTrail;
    if (item.children?.length) {
      const match = findBreadcrumbs(item.children, pathname, nextTrail);
      if (match) return match;
    }
  }
  return null;
}

export function resolveBreadcrumbs(
  items: MenuItem[],
  pathname: string,
): RouteBreadcrumbItem[] | null {
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

export function shellRouteIsActive(
  id: ShellDestinationId,
  pathname: string,
): boolean {
  if (id === "dashboard") return pathname === "/";
  if (id === "tables") return pathname === "/pos/tables";
  if (id === "pos") return pathname === "/pos/order";
  if (id === "reports") return pathname.startsWith("/report/");
  return false;
}

export function shellRouteMode(pathname: string): ShellRouteMode {
  const posWorkspace = pathname === "/pos/tables" || pathname === "/pos/order";
  return {
    fixedContent:
      posWorkspace ||
      FIXED_DATA_SCREEN_PATHS.has(pathname) ||
      FIXED_DATA_SCREEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
    mobileBackHref: pathname === "/pos/order" ? "/pos/tables" : null,
    posWorkspace,
  };
}

export function reportMenuItems(items: MenuItem[]): MenuItem[] {
  for (const item of items) {
    if (item.title === "report_menu") return item.children ?? [];
    const nested = item.children ? reportMenuItems(item.children) : [];
    if (nested.length) return nested;
  }
  return [];
}

function menuHasPath(items: MenuItem[], path: string): boolean {
  return items.some(
    (item) => item.path === path || (item.children ? menuHasPath(item.children, path) : false),
  );
}

function hasNonHeaderItem(items: MenuItem[]): boolean {
  return items.some(
    (item) => !item.is_header || (item.children ? hasNonHeaderItem(item.children) : false),
  );
}

function posOrderHref(tableUuid: string, tableName: string): Route {
  if (!tableUuid) return "/pos/tables";
  const params = new URLSearchParams({
    table_uuid: tableUuid,
    table_name: tableName,
  });
  return `/pos/order?${params.toString()}` as Route;
}

export function deriveShellDestinations({
  items,
  pathname,
  tableName,
  tableUuid,
}: {
  items: MenuItem[];
  pathname: string;
  tableName: string;
  tableUuid: string;
}): ShellDestinationState[] {
  const tablesEnabled = menuHasPath(items, "/pos/tables");
  const reportsEnabled = reportMenuItems(items).some((item) => !item.disabled);

  return [
    {
      active: shellRouteIsActive("dashboard", pathname),
      enabled: menuHasPath(items, "/"),
      href: "/",
      id: "dashboard",
    },
    {
      active: shellRouteIsActive("tables", pathname),
      enabled: tablesEnabled,
      href: "/pos/tables",
      id: "tables",
    },
    {
      active: shellRouteIsActive("pos", pathname),
      enabled: tablesEnabled,
      href: posOrderHref(tableUuid, tableName),
      id: "pos",
    },
    {
      action: "reports",
      active: shellRouteIsActive("reports", pathname),
      enabled: reportsEnabled,
      id: "reports",
    },
    {
      action: "more",
      active: false,
      enabled: hasNonHeaderItem(items),
      id: "more",
    },
  ];
}
