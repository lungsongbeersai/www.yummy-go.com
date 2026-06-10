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

export interface MenuIconOption {
  icon: LucideIcon;
  labelKey?: string;
  value: string;
}

export const MENU_ICON_OPTIONS: MenuIconOption[] = [
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

export const DEFAULT_MENU_ICON_OPTION =
  MENU_ICON_OPTIONS.find((option) => option.value === "file-text") ?? MENU_ICON_OPTIONS[0];

export function normalizeMenuIconName(value: unknown) {
  const iconName = String(value ?? "").trim();
  return MENU_ICON_OPTIONS.some((option) => option.value === iconName)
    ? iconName
    : DEFAULT_MENU_ICON_OPTION.value;
}

export function resolveMenuIcon(value: unknown) {
  const iconName = normalizeMenuIconName(value);
  return MENU_ICON_OPTIONS.find((option) => option.value === iconName)?.icon ?? DEFAULT_MENU_ICON_OPTION.icon;
}
