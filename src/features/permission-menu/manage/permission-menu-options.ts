import {
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Home,
  Layers,
  LayoutGrid,
  MapPin,
  Package,
  Palette,
  Printer,
  Ruler,
  Settings,
  ShoppingCart,
  Store,
  Table2,
  Tags,
  Users,
  Utensils,
  type LucideIcon
} from "lucide-react";
import ProjectMenu, { type MenuItem } from "@/config/menu";
import { routeBreadcrumbs, type RouteBreadcrumbItem } from "@/config/route-breadcrumbs";

export interface PickerOption {
  icon?: LucideIcon;
  labelKey?: string;
  value: string;
}

export const NAV_ICON_OPTIONS: PickerOption[] = [
  { icon: Home, labelKey: "permissionMenu.icons.home", value: "home" },
  { icon: ShoppingCart, labelKey: "permissionMenu.icons.shoppingCart", value: "shopping-cart" },
  { icon: Utensils, labelKey: "permissionMenu.icons.utensils", value: "utensils" },
  { icon: Package, labelKey: "permissionMenu.icons.package", value: "package" },
  { icon: Printer, labelKey: "permissionMenu.icons.printer", value: "printer" },
  { icon: BarChart3, labelKey: "permissionMenu.icons.report", value: "bar-chart-3" },
  { icon: Settings, labelKey: "permissionMenu.icons.settings", value: "settings" },
  { icon: Store, labelKey: "permissionMenu.icons.store", value: "store" },
  { icon: Users, labelKey: "permissionMenu.icons.users", value: "users" },
  { icon: Tags, labelKey: "permissionMenu.icons.tags", value: "tags" },
  { icon: Palette, labelKey: "permissionMenu.icons.palette", value: "palette" },
  { icon: Table2, labelKey: "permissionMenu.icons.table", value: "table" },
  { icon: MapPin, labelKey: "permissionMenu.icons.location", value: "map-pin" },
  { icon: CircleDollarSign, labelKey: "permissionMenu.icons.currency", value: "circle-dollar-sign" },
  { icon: Ruler, labelKey: "permissionMenu.icons.size", value: "ruler" },
  { icon: Layers, labelKey: "permissionMenu.icons.layers", value: "layers" },
  { icon: LayoutGrid, labelKey: "permissionMenu.icons.grid", value: "layout-grid" },
  { icon: ClipboardList, labelKey: "permissionMenu.icons.list", value: "clipboard-list" },
  { icon: FileText, labelKey: "permissionMenu.icons.file", value: "file-text" },
  { icon: FileText, labelKey: "permissionMenu.icons.fileLegacy", value: "fa fa-file" }
];

export const DEFAULT_NAV_ICON_OPTION = NAV_ICON_OPTIONS.find((option) => option.value === "file-text") ?? {
  icon: FileText,
  labelKey: "permissionMenu.icons.file",
  value: "file-text"
};

function navLabelKey(title: string) {
  return title.includes(".") ? title : `nav.${title}`;
}

function addRouteOption(options: Map<string, PickerOption>, item: RouteBreadcrumbItem, icon?: LucideIcon) {
  const path = item.path?.trim();
  if (!path || item.disabled) return;
  const current = options.get(path);
  options.set(path, {
    icon: current?.icon ?? icon,
    labelKey: current?.labelKey ?? navLabelKey(item.title),
    value: path
  });
}

function addMenuRouteOptions(options: Map<string, PickerOption>, items: MenuItem[], inheritedIcon?: LucideIcon) {
  items.forEach((item) => {
    const icon = item.icon ?? inheritedIcon;
    if (item.path) addRouteOption(options, item, icon);
    if (item.children?.length) addMenuRouteOptions(options, item.children, icon);
  });
}

export function buildProjectRouteOptions() {
  const options = new Map<string, PickerOption>();
  addMenuRouteOptions(options, ProjectMenu);
  Object.entries(routeBreadcrumbs).forEach(([path, breadcrumbs]) => {
    const current = breadcrumbs.find((item) => item.path === path) ?? breadcrumbs[breadcrumbs.length - 1];
    if (current) addRouteOption(options, { ...current, path });
  });
  return Array.from(options.values());
}

export const PROJECT_ROUTE_OPTIONS = buildProjectRouteOptions();

export const MAIN_FORM_INITIAL = {
  menu_id: "",
  menu_badge: "2",
  menu_badge_text: "",
  menu_icon: "file-text",
  menu_path: "",
  menu_status: "1",
  menu_title_eng: "",
  menu_title_la: ""
};

export const SUB_FORM_INITIAL = {
  sub_id: "",
  sub_path: "",
  sub_status: "1",
  sub_title_eng: "",
  sub_title_la: ""
};

export type MainFormState = typeof MAIN_FORM_INITIAL;
export type SubFormState = typeof SUB_FORM_INITIAL;
