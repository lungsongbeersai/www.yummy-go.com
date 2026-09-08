"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MenuItem } from "@/config/menu";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import {
  sidebarMenuCacheKey,
  usePermissionsSidebarStore,
} from "@/stores/permissions-sidebar-store";

const EMPTY_MENU_ITEMS: MenuItem[] = [];

// อ่าน sidebar permission menu ที่ AppShell (useAppShellData) เป็นคนสั่งโหลดไว้แล้วเท่านั้น —
// ไม่เรียก load() ซ้ำที่นี่ เพราะทุกหน้าที่ใช้ hook นี้เรนเดอร์อยู่ใน AppShell เสมออยู่แล้ว
// ยิงซ้ำจะเจอ requestId race แบบเดียวกับที่เคยแก้ในหน้า login (ดู resolveLandingPath)
export function useSidebarPermissionAccess(): {
  keyMatches: boolean;
  loading: boolean;
  menuItems: MenuItem[];
} {
  const { i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const items = usePermissionsSidebarStore((state) => state.items);
  const loading = usePermissionsSidebarStore((state) => state.loading);
  const requestKey = usePermissionsSidebarStore((state) => state.requestKey);

  const storeUuid = authStoreUuid(user);
  const targetRequestKey =
    storeUuid && typeof user?.status === "number"
      ? sidebarMenuCacheKey(storeUuid, user.status, i18n.language)
      : "";
  const keyMatches = Boolean(targetRequestKey) && requestKey === targetRequestKey;

  // ใช้ items จาก permission API ตรงๆ (SidebarPermissionMenuItem เข้ากันได้กับ MenuItem
  // เชิงโครงสร้างอยู่แล้ว) ไม่ map สร้าง object ใหม่อีกชั้น — memo ไว้ตาม `items`/`keyMatches`
  // ไม่งั้น consumer อย่าง use-app-shell-data.ts ที่เอาไปเข้า useMemo/useResetOnDeps ต่อ จะเห็น
  // reference "เปลี่ยน" ทุก render ทั้งที่ข้อมูลจริงเหมือนเดิม แล้ว setState วนไม่รู้จบ (เคยเจอ
  // เป็น "Too many re-renders" มาแล้วตอนไม่ได้ memo ตรงนี้)
  const menuItems = useMemo(
    () => (keyMatches ? items : EMPTY_MENU_ITEMS),
    [items, keyMatches],
  );

  return {
    keyMatches,
    loading: Boolean(targetRequestKey) && (!keyMatches || loading),
    menuItems,
  };
}
