"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CancelableBadge({ canCancel, compact = false }: { canCancel: boolean; compact?: boolean }) {
  const { t } = useTranslation();

  return canCancel ? (
    <Badge className={cn("border-primary/20 bg-primary/10 text-primary", compact && "px-1.5 text-[11px]")}>{t("cancelSale.canCancel")}</Badge>
  ) : (
    <Badge className={cn("border-border bg-muted text-muted-foreground", compact && "px-1.5 text-[11px]")}>{t("cancelSale.cannotCancel")}</Badge>
  );
}
