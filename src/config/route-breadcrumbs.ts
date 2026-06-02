import type { MenuItem } from "@/config/menu";

export type RouteBreadcrumbItem = Pick<MenuItem, "disabled" | "path" | "title">;

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
  "/setting/permission-menu": [{ path: "/setting/permission-menu", title: "permission_menu" }],
  "/setting/unite": [{ path: "/setting/unite", title: "unit" }],
  "/permission-store": [{ path: "/permission-store", title: "permission_store" }],
  "/profile": [{ path: "/profile", title: "profile" }]
};
