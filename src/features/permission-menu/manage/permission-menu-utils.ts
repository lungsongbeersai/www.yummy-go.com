import { FileText } from "lucide-react";
import {
  DEFAULT_NAV_ICON_OPTION,
  NAV_ICON_OPTIONS,
  PROJECT_ROUTE_OPTIONS,
  type PickerOption
} from "@/features/permission-menu/manage/permission-menu-options";
import type { PermissionMainMenu, PermissionSubMenu } from "@/services/permission-menu";

export type PermissionMenuTranslate = (key: string, options?: Record<string, unknown>) => string;

export type PermissionMenuDeleteTarget =
  | { menu: PermissionMainMenu; type: "main" }
  | { menu: PermissionMainMenu; submenu: PermissionSubMenu; type: "sub" };

export type PermissionMenuMoveDirection = "down" | "up";

export function menuSubmenus(menu: PermissionMainMenu) {
  return [...menu.sub_detail].sort((a, b) => a.sub_sort - b.sub_sort || a.sub_title.localeCompare(b.sub_title));
}

export function filterPermissionMenus(menus: PermissionMainMenu[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return menus;

  return menus.filter((menu) => {
    const submenus = menu.sub_detail.map((submenu) =>
      [submenu.sub_title, submenu.sub_title_eng, submenu.sub_title_la, submenu.sub_path].join(" ")
    );
    return [
      menu.menu_title,
      menu.menu_title_eng,
      menu.menu_title_la,
      menu.menu_path,
      menu.menu_icon,
      menu.menu_badge_text,
      ...submenus
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function movePermissionItem<T>(
  items: T[],
  itemId: string,
  direction: PermissionMenuMoveDirection,
  getId: (item: T) => string
) {
  const from = items.findIndex((item) => getId(item) === itemId);
  if (from < 0) return items;

  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const [item] = next.splice(from, 1);
  if (!item) return items;
  next.splice(to, 0, item);
  return next;
}

export function resolveSelectedPermissionMenuId(
  menus: Pick<PermissionMainMenu, "menu_id">[],
  selectedMenuId: string | null | undefined
) {
  if (selectedMenuId && menus.some((menu) => menu.menu_id === selectedMenuId)) return selectedMenuId;
  return menus[0]?.menu_id ?? "";
}

export function statusLabel(status: number, t: PermissionMenuTranslate) {
  return status === 2 ? t("permissionMenu.subStatusPlcOnly") : t("permissionMenu.subStatusAllUsers");
}

export function menuStatusLabel(status: number, t: PermissionMenuTranslate) {
  return status === 1 ? t("permissionMenu.menuStatusShow") : t("permissionMenu.menuStatusHide");
}

export function statusClass(status: number) {
  return status === 1
    ? "border-primary/30 bg-primary/10 text-primary"
    : "border-border bg-secondary text-secondary-foreground";
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

export function badgeLabel(value: number | string, t: PermissionMenuTranslate, badgeText?: string) {
  const text = menuBadgeText(value, badgeText);
  if (Number(value) === 1 && text) return t("permissionMenu.badgeTextValue", { text });
  return Number(value) === 1 ? t("permissionMenu.badgeShow") : t("permissionMenu.badgeHide");
}

export function menuBadgeText(value: number | string, badgeText?: string) {
  const text = String(badgeText ?? "").trim();
  return Number(value) === 1 ? text : "";
}

export function menuIds(menus: PermissionMainMenu[]) {
  return menus.map((menu) => menu.menu_id);
}

export function submenuIds(submenus: PermissionSubMenu[]) {
  return submenus.map((submenu) => submenu.sub_id);
}
