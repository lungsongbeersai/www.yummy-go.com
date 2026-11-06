import type { MenuItem } from "@/config/menu";

interface SidebarPermissionAccessInput {
  items: MenuItem[];
  loading: boolean;
  requestKey: string;
  targetRequestKey: string;
}

const EMPTY_MENU_ITEMS: MenuItem[] = [];

export function resolveSidebarPermissionAccess({
  items,
  loading,
  requestKey,
  targetRequestKey,
}: SidebarPermissionAccessInput) {
  const keyMatches = Boolean(targetRequestKey) && requestKey === targetRequestKey;
  const menuItems = keyMatches ? items : EMPTY_MENU_ITEMS;

  // The store retains only a verified active menu while refreshing that scope.
  // Blocking it would unmount the dashboard and reset its filters every poll.
  return {
    keyMatches,
    loading: Boolean(targetRequestKey) && (!keyMatches || (loading && menuItems.length === 0)),
    menuItems,
  };
}
