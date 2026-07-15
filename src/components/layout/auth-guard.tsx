"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { useAuthStore } from "@/stores/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn) {
      // พาไปหน้าแนะนำบริษัท (/home) ก่อนเข้าสู่ระบบ — ปุ่ม login บนหน้านั้นจะพก redirect ต่อไปให้
      // ส่วนกรณี session หมดอายุระหว่างใช้งาน (401 ใน lib/api.ts) ยังพาไป /login ตรง ๆ เหมือนเดิม
      router.replace(`/home?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isLoggedIn, pathname, router]);

  if (!hydrated || !isLoggedIn) {
    return <LoadingState label={t("common.processing")} />;
  }

  return <>{children}</>;
}
