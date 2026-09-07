// Every protected menu destination is viewable while offline on every platform.
// Data comes from Agent SQLite on desktop or the scoped Dexie response mirror on
// Capacitor. Mutations remain governed separately by OFFLINE_ROUTES in
// services/offline-sync.ts; opening a page never implies that its writes are safe.
export const OFFLINE_READ_ONLY_PATHS = [
  "/package",
  "/products",
  "/stock",
  "/printers",
  "/sales/sales-list",
  "/sales/cancel-sale",
  "/sales/cancel-history",
  "/sales/credit",
  "/report/daily-closing",
  "/report/daily-sales",
  "/report/best-selling-products",
  "/report/payment-methods",
  "/report/category-sales",
  "/report/order-audit",
  "/settings/store",
  "/settings/branch",
  "/settings/province",
  "/settings/district",
  "/settings/topping",
  "/settings/group",
  "/settings/category",
  "/settings/unit",
  "/settings/size",
  "/settings/color",
  "/settings/zone",
  "/settings/table",
  "/settings/currency",
  "/settings/exchange",
  "/settings/customer",
  "/settings/user",
  "/settings/manage-menu",
  "/settings/manage-access-permissions",
] as const;

// These screens have an established durable offline workflow in addition to
// being viewable. Some operations inside them remain platform-specific; the API
// transport rejects unsupported mobile operations instead of staging unsafe work.
export const OFFLINE_WRITE_CAPABLE_PATHS = [
  "/pos/tables",
  "/pos/order",
  "/order_manage",
  "/report/offline-sync",
  "/sales/stuck-orders",
] as const;

// App-entry and account/navigation shells contain no page-level business write.
export const OFFLINE_INFRA_PATHS = [
  "/",
  "/home",
  "/policy",
  "/login",
  "/pos",
  "/more",
  "/profile",
] as const;

export const OFFLINE_PROTECTED_PATHS = [
  ...OFFLINE_READ_ONLY_PATHS,
  ...OFFLINE_WRITE_CAPABLE_PATHS,
] as const;

export function getOfflineAllowedPaths(isMobileNative: boolean): readonly string[] {
  // Route access is intentionally identical on desktop and Capacitor. Transport
  // capabilities still differ and are enforced per endpoint in offline-sync.ts.
  void isMobileNative;
  return OFFLINE_PROTECTED_PATHS;
}

export function isOfflineAllowedPath(pathname: string, isMobileNative: boolean): boolean {
  return (
    (OFFLINE_INFRA_PATHS as readonly string[]).includes(pathname) ||
    getOfflineAllowedPaths(isMobileNative).includes(pathname)
  );
}

export function getOfflineRedirectPath(isMobileNative: boolean): string {
  return isMobileNative ? "/sales/sales-list" : "/pos/tables";
}
