import { FileText } from "lucide-react";
import {
  DEFAULT_NAV_ICON_OPTION,
  NAV_ICON_OPTIONS,
  PROJECT_ROUTE_OPTIONS,
  type PickerOption
} from "@/features/permission-menu/manage/permission-menu-options";
import type { PermissionMainMenu, PermissionSubMenu } from "@/services/permission-menu";

export type PermissionMenuTranslate = (key: string) => string;

export type PermissionMenuDeleteTarget =
  | { menu: PermissionMainMenu; type: "main" }
  | { menu: PermissionMainMenu; submenu: PermissionSubMenu; type: "sub" };

export function menuSubmenus(menu: PermissionMainMenu) {
  return [...menu.sub_detail].sort((a, b) => a.sub_sort - b.sub_sort || a.sub_title.localeCompare(b.sub_title));
}

export function statusLabel(status: number, t: PermissionMenuTranslate) {
  return status === 1 ? t("common.active") : t("common.inactive");
}

export function menuStatusLabel(status: number, t: PermissionMenuTranslate) {
  return status === 1 ? t("permissionMenu.menuStatusShow") : t("permissionMenu.menuStatusHide");
}

export function statusClass(status: number) {
  return status === 1
    ? "border-primary/30 bg-primary/10 text-primary"
    : "border-destructive/20 bg-destructive/10 text-destructive";
}

export function optionLabel(option: PickerOption, t: PermissionMenuTranslate) {
  return option.labelKey ? t(option.labelKey) : option.value;
}

export function fallbackOption(value: string, options: PickerOption[], fallback: PickerOption): PickerOption {
  if (!value) return fallback;
  return options.find((option) => option.value === value) ?? { icon: fallback.icon, value };
}

export function iconOption(value: string) {
  return fallbackOption(value, NAV_ICON_OPTIONS, DEFAULT_NAV_ICON_OPTION);
}

export function pathOption(value: string) {
  return fallbackOption(value, PROJECT_ROUTE_OPTIONS, { icon: FileText, value });
}

export function badgeLabel(value: number | string, t: PermissionMenuTranslate) {
  return Number(value) === 1 ? t("permissionMenu.badgeShow") : t("permissionMenu.badgeHide");
}

export function menuIds(menus: PermissionMainMenu[]) {
  return menus.map((menu) => menu.menu_id);
}

export function submenuIds(submenus: PermissionSubMenu[]) {
  return submenus.map((submenu) => submenu.sub_id);
}

export function defaultExpandedMenuIds(menus: PermissionMainMenu[]) {
  return menus.filter((menu) => menu.sub_detail.length > 0).map((menu) => menu.menu_id);
}
