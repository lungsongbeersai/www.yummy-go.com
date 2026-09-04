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
      //
      // sticky + ความสูงคงที่ใต้ top bar (แทนที่จะปล่อยให้สูงเท่า main) — .app-shell-body
      // ใช้ min-height ไม่ใช่ height บนหน้าปกติ (ดู globals.css) เพจที่เนื้อหายาวเลยสกรอลทั้ง
      // เอกสารเป็นก้อนเดียว ไม่มี fixed-height ancestor ให้ overflow-y-auto ทำงานจริง — rail ก็เลย
      // เลื่อนหายไปพร้อมเนื้อหาแทนที่จะค้างอยู่เหมือน .native-top-bar ที่เป็น sticky top-0 อยู่แล้ว
      className="sticky top-(--app-shell-header-height) hidden h-[calc(100dvh-var(--app-shell-header-height))] w-(--app-shell-side-rail-width) shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card px-1 py-2 md:flex"
    >
      <NativeNavItems
        error={error}
        layout="rail"
        loading={loading}
        model={model}
        onRetry={onRetry}
        pathname={pathname}
      />
    </nav>
  );
}
