"use client";

import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CancelBillState } from "./cancel-sale-utils";

export function CancelableBadge({ canCancel, compact = false }: { canCancel: boolean; compact?: boolean }) {
  const { t } = useTranslation();

  // "ยกเลิกได้" เป็นสถานะความสามารถ ไม่ใช่ action ของแบรนด์ — ใช้ --info (คงที่) แทน --primary
  // (เปลี่ยนตามธีมสี) กันไม่ให้ความหมายของ badge เพี้ยนไปตามธีมที่ผู้ใช้เลือก
  return canCancel ? (
    <Badge className={cn("border-info/25 bg-info/10 text-info", compact && "px-1.5 text-2xs")}>{t("cancelSale.canCancel")}</Badge>
  ) : (
    <Badge className={cn("gap-1 border-border bg-muted text-muted-foreground", compact && "px-1.5 text-2xs")}>
      <Lock aria-hidden="true" className="size-3" />
      {t("cancelSale.cannotCancel")}
    </Badge>
  );
}

const STATE_CLASS: Record<CancelBillState, string> = {
  paid: "border-success/25 bg-success/10 text-success",
  debt: "border-warning/25 bg-warning/10 text-warning-text",
  cancelled: "border-destructive/25 bg-destructive/10 text-destructive"
};

const STATE_LABEL: Record<CancelBillState, string> = {
  paid: "cancelSale.statePaid",
  debt: "cancelSale.stateDebt",
  cancelled: "cancelSale.stateCancelled"
};

/** แทน badge เลข order_status ดิบ ("2") ที่อ่านไม่รู้เรื่อง — ดู billState */
export function BillStateBadge({ state, compact = false }: { state: CancelBillState; compact?: boolean }) {
  const { t } = useTranslation();

  return (
    <Badge className={cn(STATE_CLASS[state], compact && "px-1.5 py-0 text-2xs leading-4")}>{t(STATE_LABEL[state])}</Badge>
  );
}
