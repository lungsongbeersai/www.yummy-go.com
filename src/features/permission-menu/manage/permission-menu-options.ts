import type { LucideIcon } from "lucide-react";
import ProjectMenu, { type MenuItem } from "@/config/menu";
import { routeBreadcrumbs, type RouteBreadcrumbItem } from "@/config/route-breadcrumbs";
import { DEFAULT_MENU_ICON } from "@/lib/menu-icons";

export interface PickerOption {
  icon?: LucideIcon;
  labelKey?: string;
  value: string;
}

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
  menu_icon: DEFAULT_MENU_ICON,
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
