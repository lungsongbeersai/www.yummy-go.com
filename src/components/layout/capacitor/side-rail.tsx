"use client";

import { useTranslation } from "react-i18next";
import type { NativeNavigationModel } from "@/components/layout/native-navigation-model";
import { NativeNavItems } from "@/components/layout/capacitor/nav-destination-button";

export function NativeSideRail({
  error,
  loading,
  model,
  onRetry,
  pathname,
}: {
  error: string | null;
  loading: boolean;
  model: NativeNavigationModel;
  onRetry: () => void;
  pathname: string;
}) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("app.navigation")}
      // rail เลื่อนได้เอง ต่างจาก Flutter NavigationRail — เพิ่มจำนวนปลายทางภายหลังได้โดยไม่ต้องรื้อ
      className="hidden w-(--app-shell-side-rail-width) shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card px-1 py-2 md:flex"
    >
      <NativeNavItems
        error={error}
        loading={loading}
        model={model}
        onRetry={onRetry}
        pathname={pathname}
      />
    </nav>
  );
}
