"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderAuditAction } from "@/services/report";

const ACTION_BADGE_CLASSES: Record<OrderAuditAction, string> = {
  CREATE: "border-success/25 bg-success/10 text-success",
  UPDATE: "border-warning/25 bg-warning/10 text-warning",
  DELETE: "border-destructive/25 bg-destructive/10 text-destructive",
  DISCOUNT: "border-warning/25 bg-warning/10 text-warning",
  PRICE: "border-warning/25 bg-warning/10 text-warning",
  QUANTITY: "border-warning/25 bg-warning/10 text-warning",
  CANCEL: "border-destructive/25 bg-destructive/10 text-destructive",
  MOVE: "border-warning/25 bg-warning/10 text-warning",
  PAYMENT: "border-info/25 bg-info/10 text-info",
};

export function OrderAuditActionBadge({ action, label }: { action: OrderAuditAction; label: string }) {
  return (
    <Badge variant="outline" className={cn(ACTION_BADGE_CLASSES[action])}>
      {label}
    </Badge>
  );
}
