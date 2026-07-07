import type { MenuItem } from "@/config/menu";
import type { SidebarPermissionMenuItem } from "@/services/sidebar-menu";

export function sidebarPermissionMenuItemsToMenuItems(
  items: SidebarPermissionMenuItem[]
): MenuItem[] {
  return items.map((item) => ({
    badgeText: item.badgeText,
    children: item.children?.length ? sidebarPermissionMenuItemsToMenuItems(item.children) : undefined,
    disabled: item.disabled,
    iconName: item.iconName,
    label: item.label,
    path: item.path,
    source: item.source,
    title: item.title
  }));
}
