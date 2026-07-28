import {
  BarChart3,
  Home,
  Package,
  Printer,
  Settings,
  ShoppingCart,
  Utensils
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ROLE_STATUS, STORE_BRANCH_VIEW_STATUSES } from "@/lib/permissions";

export type MenuItem = {
  is_header?: boolean;
  title: string;
  path?: string;
  icon?: LucideIcon;
  iconName?: string;
  label?: string;
  badgeText?: string;
  source?: "permission-api" | "static";
  children?: MenuItem[];
  allowedStatus?: number[];
  disabled?: boolean;
};

const disabledReportItems: MenuItem[] = [
  { path: "/report/daily-sales", title: "daily_sales_report" },
  { path: "/report/daily-closing", title: "daily_store_closing_report" },
  { path: "/report/best-selling-products", title: "best_selling_products_report" },
  { path: "/report/payment-methods", title: "payment_methods_report" },
  { path: "/report/category-sales", title: "category_sales_report" },
  { path: "/report/monthly-sales", title: "monthly_sales_report", disabled: true },
  { path: "/report/bill-sales-summary", title: "bill_sales_summary", disabled: true },
  { path: "/report/stock", title: "stock_report_menu", disabled: true },
  { path: "/report/cancel-sales-invoice", title: "cancel_sales_invoice_report", disabled: true },
  { path: "/report/discount", title: "discount_report", disabled: true },
  { path: "/report/service-charge", title: "service_charge_summary", disabled: true },
  { path: "/report/vat", title: "vat_summary", disabled: true }
];

const Menu: MenuItem[] = [
  { is_header: true, title: "manage" },
  { path: "/", icon: Home, title: "dashboard" },
  {
    icon: ShoppingCart,
    title: "sales",
    children: [
      { path: "/pos/tables", title: "open_table_sale" },
      { path: "/sales/sales-list", title: "sales_list" },
      { path: "/sales/cancel-sale", title: "cancel_sale" },
      { path: "/sales/cancel-history", title: "cancel_history" }
    ]
  },
  { path: "/package", icon: Package, title: "package_management" },
  { path: "/products", icon: Utensils, title: "menu_add_item" },
  { path: "/stock", icon: Package, title: "stock_quantity" },
  { path: "/printers", icon: Printer, title: "printer_management" },
  {
    icon: BarChart3,
    title: "report_menu",
    children: disabledReportItems
  },
  {
    path: "/settings",
    icon: Settings,
    title: "settings",
    children: [
      { path: "/settings/store", title: "store", allowedStatus: STORE_BRANCH_VIEW_STATUSES },
      { path: "/settings/branch", title: "branch", allowedStatus: STORE_BRANCH_VIEW_STATUSES },
      { path: "/settings/province", title: "province" },
      { path: "/settings/district", title: "district" },
      { path: "/settings/topping", title: "topping" },
      { path: "/settings/group", title: "food_group" },
      { path: "/settings/category", title: "category" },
      { path: "/settings/unit", title: "unit" },
      { path: "/settings/size", title: "size" },
      { path: "/settings/color", title: "color" },
      { path: "/settings/zone", title: "zone" },
      { path: "/settings/table", title: "table" },
      { path: "/settings/currency", title: "currency" },
      { path: "/settings/exchange", title: "exchange_rate" },
      { path: "/settings/customer", title: "customer" },
      { path: "/settings/user", title: "user" },
      { path: "/settings/manage-menu", title: "manage_menu", allowedStatus: [ROLE_STATUS.SUPER_ADMIN] },
      { path: "/settings/manage-access-permissions", title: "manage_access_permissions" }
    ]
  }
];

export default Menu;
