import type { MenuItem } from "@/config/menu";

export type RouteBreadcrumbItem = Pick<MenuItem, "disabled" | "label" | "path" | "title">;

export const routeBreadcrumbs: Record<string, RouteBreadcrumbItem[]> = {
  "/product/form": [
    { path: "/product", title: "menu_add_item" },
    { path: "/product/form", title: "product_form" }
  ],
  "/printer/form": [
    { path: "/printer", title: "printer_management" },
    { path: "/printer/form", title: "printer_form" }
  ],
  "/sale/counter-checkout": [{ path: "/sale/counter-checkout", title: "counter_checkout" }],
  "/sale/order-customer": [{ path: "/sale/order-customer", title: "customer_order" }],
  "/sales/cancel-sale": [
    { disabled: true, title: "sales" },
    { path: "/sales/cancel-sale", title: "cancel_sale" }
  ],
  "/sales/sales-list": [
    { disabled: true, title: "sales" },
    { path: "/sales/sales-list", title: "sales_list" }
  ],
  "/setting/manage-menu": [{ path: "/setting/manage-menu", title: "manage_menu" }],
  "/setting/unite": [{ path: "/setting/unite", title: "unit" }],
  "/setting/manage-access-permissions": [
    { path: "/setting/manage-access-permissions", title: "manage_access_permissions" }
  ],
  "/profile": [{ path: "/profile", title: "profile" }]
};
