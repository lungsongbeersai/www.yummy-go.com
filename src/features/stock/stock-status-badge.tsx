"use client";

import {
  CircleCheck,
  CircleX,
  ListFilter,
  TriangleAlert,
  type LucideIcon
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { StockStatus } from "@/services/stock";
import { stockStatusTranslationKey } from "./stock-utils";

interface StockStatusBadgeProps {
  status: StockStatus;
}

const STATUS_PRESENTATION: Record<
  StockStatus,
  { icon: LucideIcon; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  all: { icon: ListFilter, variant: "outline" },
  in_stock: { icon: CircleCheck, variant: "default" },
  low_stock: { icon: TriangleAlert, variant: "secondary" },
  out_of_stock: { icon: CircleX, variant: "destructive" }
};

export function StockStatusBadge({ status }: StockStatusBadgeProps) {
  const { t } = useTranslation();
  const presentation = STATUS_PRESENTATION[status];
  const Icon = presentation.icon;

  return (
    <Badge variant={presentation.variant}>
      <Icon aria-hidden="true" />
      {t(stockStatusTranslationKey(status))}
    </Badge>
  );
}
