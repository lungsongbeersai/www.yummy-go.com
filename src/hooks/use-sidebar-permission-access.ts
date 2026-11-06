"use client";

import { useTranslation } from "react-i18next";
import { resolveSidebarPermissionAccess } from "@/hooks/sidebar-permission-access-state";
import type { MenuItem } from "@/config/menu";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import {
  sidebarMenuCacheKey,
  usePermissionsSidebarStore,
} from "@/stores/permissions-sidebar-store";

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
  return resolveSidebarPermissionAccess({
    items,
    loading,
    requestKey,
    targetRequestKey,
  });
}
