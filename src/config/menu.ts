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
  children?: MenuItem[];
  allowedStatus?: number[];
  disabled?: boolean;
};

const disabledReportItems: MenuItem[] = [
  { path: "/report/daily-sales", title: "daily_sales_report" },
  { path: "/report/best-selling-products", title: "best_selling_products_report" },
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
      { path: "/sales/open-table-sale", title: "open_table_sale" },
      { path: "/sales/sales-list", title: "sales_list" }
    ]
  },
  { path: "/product", icon: Utensils, title: "menu_add_item" },
  { icon: Package, title: "stock_quantity", disabled: true },
  { path: "/printer", icon: Printer, title: "printer_management" },
  {
    icon: BarChart3,
    title: "report_menu",
    children: disabledReportItems
  },
  {
    path: "/setting",
    icon: Settings,
    title: "settings",
    children: [
      { path: "/setting/store", title: "store", allowedStatus: STORE_BRANCH_VIEW_STATUSES },
      { path: "/setting/branch", title: "branch", allowedStatus: STORE_BRANCH_VIEW_STATUSES },
      { path: "/setting/province", title: "province" },
      { path: "/setting/district", title: "district" },
      { path: "/setting/topping", title: "topping" },
      { path: "/setting/group", title: "food_group" },
      { path: "/setting/category", title: "category" },
      { path: "/setting/unit", title: "unit" },
      { path: "/setting/size", title: "size" },
      { path: "/setting/color", title: "color" },
      { path: "/setting/zone", title: "zone" },
      { path: "/setting/table", title: "table" },
      { path: "/setting/currency", title: "currency" },
      { path: "/setting/exchange", title: "exchange_rate" },
      { path: "/setting/customer", title: "customer" },
      { path: "/setting/user", title: "user" },
      { path: "/setting/permission-menu", title: "permission_menu", allowedStatus: [ROLE_STATUS.SUPER_ADMIN] },
      { path: "/permission-store", title: "permission_store", allowedStatus: [ROLE_STATUS.SUPER_ADMIN] }
    ]
  }
];

export default Menu;
