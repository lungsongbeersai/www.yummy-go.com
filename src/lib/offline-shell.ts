// These are HTML shells, not API/data permissions. AuthGuard still owns access.
export const OFFLINE_SHELL_ROUTES = [
  "/", "/login", "/pos", "/pos/tables", "/pos/order", "/order_manage",
  "/products", "/stock", "/printers", "/sales/sales-list", "/report/daily-closing",
  "/report/daily-sales", "/report/best-selling-products",
  "/report/payment-methods", "/report/category-sales",
  "/settings/user", "/settings/branch",
] as const;

export const CORE_OFFLINE_SHELL_ROUTES = ["/login", "/pos/tables", "/pos/order"] as const;

export function isOfflineShellRoute(path: string) {
  return OFFLINE_SHELL_ROUTES.some((route) => route === path);
}
