"use client";

import { useEffect, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";

const DEFAULT_LOADING_MS = 180;

export function useDropdownButtonLoading({
  delay = DEFAULT_LOADING_MS,
  loading = false,
  loadingKey,
  open
}: {
  delay?: number;
  loading?: boolean;
  loadingKey?: number | string;
  open: boolean;
}) {
  const [opening, setOpening] = useState(false);

  // เปิด dropdown = โชว์ spinner ทันที (แยกออกจาก effect เพื่อไม่ให้ช้าไปหนึ่งเฟรม)
  useResetOnDeps([delay, loadingKey, open], () => setOpening(open));

  // effect เหลือหน้าที่คุม timer ที่ปิด spinner เมื่อครบเวลา
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpening(false), delay);
    return () => window.clearTimeout(timer);
  }, [delay, loadingKey, open]);

  return open && (loading || opening);
}
