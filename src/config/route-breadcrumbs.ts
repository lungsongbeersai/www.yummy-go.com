import type { MenuItem } from "@/config/menu";

export type RouteBreadcrumbItem = Pick<MenuItem, "disabled" | "label" | "path" | "title">;

export const routeBreadcrumbs: Record<string, RouteBreadcrumbItem[]> = {
  "/package": [{ path: "/package", title: "package_management" }],
  "/products/form": [
    { path: "/products", title: "menu_add_item" },
    { path: "/products/form", title: "product_form" }
  ],
  "/printers/form": [
    { path: "/printers", title: "printer_management" },
    { path: "/printers/form", title: "printer_form" }
  ],
  "/pos/order": [{ path: "/pos/order", title: "customer_order" }],
  "/sales/cancel-sale": [
    { disabled: true, title: "sales" },
    { path: "/sales/cancel-sale", title: "cancel_sale" }
  ],
  "/sales/sales-list": [
    { disabled: true, title: "sales" },
    { path: "/sales/sales-list", title: "sales_list" }
  ],
  "/report/daily-closing": [
    { disabled: true, title: "report_menu" },
    { path: "/report/daily-closing", title: "daily_store_closing_report" }
  ],
  "/settings/manage-menu": [{ path: "/settings/manage-menu", title: "manage_menu" }],
  "/settings/unit": [{ path: "/settings/unit", title: "unit" }],
  "/settings/manage-access-permissions": [
    { path: "/settings/manage-access-permissions", title: "manage_access_permissions" }
  ],
  "/profile": [{ path: "/profile", title: "profile" }],
  "/more": [{ path: "/more", title: "more" }]
};
