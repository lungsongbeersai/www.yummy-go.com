"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// backend ส่ง status เป็น string ("1" = เปิดใช้งาน, ค่าว่างถือเป็นเปิด)
export function isActiveStatus(status: string) {
  return Number(status || 1) === 1;
}

export function statusBadgeClass(active: boolean) {
  return active
    ? "border-primary/25 bg-primary/10 text-primary"
    : "border-muted-foreground/20 bg-muted text-muted-foreground";
}

// Badge สถานะเปิด/ปิดใช้งานมาตรฐานเดียวกันทุกหน้า — เดิมถูกเขียนซ้ำ 8+ จุด
export function StatusBadge({
  active,
  className,
  label,
}: {
  active: boolean;
  className?: string;
  label?: string;
}) {
  const { t } = useTranslation();

  return (
    <Badge className={cn(statusBadgeClass(active), className)}>
      {label ?? (active ? t("common.active") : t("common.inactive"))}
    </Badge>
  );
}
