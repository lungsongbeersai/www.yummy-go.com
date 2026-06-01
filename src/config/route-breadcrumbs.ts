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
  "/profile": [{ path: "/profile", title: "profile" }]
};
