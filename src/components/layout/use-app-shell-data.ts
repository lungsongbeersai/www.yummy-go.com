"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  isFixedDataScreen,
  isImmersiveScreen,
} from "@/components/layout/shell-menu-helpers";
import {
  resolveShellBreadcrumbs,
  type BreadcrumbTrailItem,
} from "@/components/layout/shell-breadcrumbs";
import { sidebarPermissionMenuItemsToMenuItems } from "@/config/sidebar-permission-menu";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import {
  sidebarMenuCacheKey,
  usePermissionsSidebarStore,
} from "@/stores/permissions-sidebar-store";

// ทั้ง web shell และ capacitor shell ใช้เมนู/breadcrumb ชุดเดียวกัน — รวมไว้ที่นี่จุดเดียว
// เพื่อไม่ให้เกิด navigation model ชุดที่สองที่หลุดจากสิทธิ์จริง (ปัญหาเดิมของ shell-navigation.ts)
export function useAppShellData() {
  const pathname = usePathname();
  const { i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const sidebarItems = usePermissionsSidebarStore((state) => state.items);
  const sidebarError = usePermissionsSidebarStore((state) => state.error);
  const sidebarLoading = usePermissionsSidebarStore((state) => state.loading);
  const sidebarRequestKey = usePermissionsSidebarStore(
    (state) => state.requestKey,
  );
  const clearSidebarMenu = usePermissionsSidebarStore(
    (state) => state.clearActive,
  );
  const loadSidebarMenu = usePermissionsSidebarStore((state) => state.load);

  const storeUuid = authStoreUuid(user);
  const targetSidebarRequestKey =
    storeUuid && typeof user?.status === "number"
      ? sidebarMenuCacheKey(storeUuid, user.status, i18n.language)
      : "";
  const sidebarKeyMatches =
    Boolean(targetSidebarRequestKey) &&
    sidebarRequestKey === targetSidebarRequestKey;

  const menuItems = useMemo(
    () =>
      sidebarPermissionMenuItemsToMenuItems(
        sidebarKeyMatches ? sidebarItems : [],
      ),
    [sidebarItems, sidebarKeyMatches],
  );

  const menuLoading =
    Boolean(targetSidebarRequestKey) &&
    (!sidebarKeyMatches || sidebarLoading) &&
    menuItems.length === 0;
  const menuError = sidebarKeyMatches ? sidebarError : null;

  const breadcrumbs = useMemo(() => {
    const home: BreadcrumbTrailItem = { path: "/", title: "dashboard" };
    const trail = resolveShellBreadcrumbs(menuItems, pathname);
    if (!trail) return [home];
    if (trail[0]?.path === "/") return trail;
    return [home, ...trail];
  }, [menuItems, pathname]);

  useEffect(() => {
    if (!storeUuid || typeof user?.status !== "number") {
      clearSidebarMenu();
      return;
    }
    void loadSidebarMenu(storeUuid, user.status, i18n.language);
  }, [
    clearSidebarMenu,
    i18n.language,
    loadSidebarMenu,
    storeUuid,
    user?.status,
  ]);

  function retrySidebarMenu() {
    if (!storeUuid || typeof user?.status !== "number") return;
    void loadSidebarMenu(storeUuid, user.status, i18n.language);
  }

  return {
    breadcrumbs,
    dashboardScreen: pathname === "/",
    fixedDataScreen: isFixedDataScreen(pathname),
    immersiveScreen: isImmersiveScreen(pathname),
    menuError,
    menuItems,
    menuLoading,
    pathname,
    retrySidebarMenu,
  };
}
