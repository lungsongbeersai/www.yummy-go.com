"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CancelableBadge({ canCancel, compact = false }: { canCancel: boolean; compact?: boolean }) {
  const { t } = useTranslation();

  // "ยกเลิกได้" เป็นสถานะความสามารถ ไม่ใช่ action ของแบรนด์ — ใช้ --info (คงที่) แทน --primary
  // (เปลี่ยนตามธีมสี) กันไม่ให้ความหมายของ badge เพี้ยนไปตามธีมที่ผู้ใช้เลือก
  return canCancel ? (
    <Badge className={cn("border-info/25 bg-info/10 text-info", compact && "px-1.5 text-[11px]")}>{t("cancelSale.canCancel")}</Badge>
  ) : (
    <Badge className={cn("border-border bg-muted text-muted-foreground", compact && "px-1.5 text-[11px]")}>{t("cancelSale.cannotCancel")}</Badge>
  );
}
