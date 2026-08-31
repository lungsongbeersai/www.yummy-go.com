"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  applyOfflineLock,
  isFixedDataScreen,
  isImmersiveScreen,
} from "@/components/layout/shell-menu-helpers";
import { useIsAndroidNativeApp } from "@/hooks/use-android-native-app";
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

const DATA_SCREEN_SCROLL_LOCK_CLASS = "data-screen-scroll-lock";
const POS_ANDROID_SYSTEM_SCREEN_CLASS = "pos-android-system-screen";

function useDocumentClass(className: string, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { body, documentElement } = document;
    documentElement.classList.add(className);
    body.classList.add(className);

    return () => {
      documentElement.classList.remove(className);
      body.classList.remove(className);
    };
  }, [active, className]);
}

// ทั้ง web shell และ capacitor shell ใช้เมนู/breadcrumb ชุดเดียวกัน — รวมไว้ที่นี่จุดเดียว
// เพื่อไม่ให้เกิด navigation model ชุดที่สองที่หลุดจากสิทธิ์จริง (ปัญหาเดิมของ shell-navigation.ts)
export function useAppShellData() {
  const pathname = usePathname();
  const { i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const offlineSession = useAuthStore((state) => state.offlineSession);
  const isAndroidNative = useIsAndroidNativeApp();
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
      applyOfflineLock(
        sidebarPermissionMenuItemsToMenuItems(
          sidebarKeyMatches ? sidebarItems : [],
        ),
        offlineSession,
        isAndroidNative,
      ),
    [isAndroidNative, offlineSession, sidebarItems, sidebarKeyMatches],
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

  const fixedDataScreen = isFixedDataScreen(pathname);
  const immersiveScreen = isImmersiveScreen(pathname);

  // หน้าที่มี scroll ภายในของตัวเองต้องล็อก document ไม่งั้นเลื่อนสองชั้น
  useDocumentClass(DATA_SCREEN_SCROLL_LOCK_CLASS, fixedDataScreen);
  // หน้า POS แบบเต็มจอบน Android ต้องกันพื้นที่ให้ system bar — globals.css ใช้ class นี้
  // ลด --pos-system-bottom-safe-area ให้ footer ของ dialog ไม่มีช่องว่างเกิน
  useDocumentClass(
    POS_ANDROID_SYSTEM_SCREEN_CLASS,
    immersiveScreen && /android/i.test(navigator.userAgent),
  );

  return {
    breadcrumbs,
    dashboardScreen: pathname === "/",
    fixedDataScreen,
    immersiveScreen,
    menuError,
    menuItems,
    menuLoading,
    pathname,
    retrySidebarMenu,
  };
}
