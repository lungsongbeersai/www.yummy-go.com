"use client";

import { useTranslation } from "react-i18next";
import type { NativeNavigationModel } from "@/components/layout/native-navigation-model";
import { NativeNavItems } from "@/components/layout/capacitor/nav-destination-button";

export function NativeBottomNav({
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
      // [&>*]:flex-1 ทับ flex-none ของปุ่มที่ใช้ร่วมกับ side rail ให้แบ่งความกว้างเท่ากันเฉพาะแถวนอนนี้
      // (side rail เป็นแนวตั้ง ถ้าปุ่มมี flex-1 ติดมาเองจะถูกยืดเต็มความสูง) — อาศัยลำดับที่ Tailwind
      // emit utility เปล่าก่อน arbitrary-variant ทั้งสอง class จึง specificity เท่ากันแต่ตัวนี้ชนะ
      // in-data-...:hidden ซ่อนทั้งแถบตอนคีย์บอร์ดขึ้น เพราะลำพัง --app-shell-bottom-nav-height: 0px
      // ยังเหลือ border-t + pt-1 เป็นเส้นบาง ๆ ค้างเหนือคีย์บอร์ด
      className="fixed inset-x-0 bottom-0 z-40 flex h-(--app-shell-bottom-nav-height) items-start gap-0.5 border-t border-border bg-card px-1 pt-1 pb-[env(safe-area-inset-bottom,0px)] in-data-[keyboard-open=true]:hidden md:hidden [&>*]:flex-1"
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
