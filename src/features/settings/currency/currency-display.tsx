"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { currencyStatusBadgeClass, currencyStatusLabel } from "./currency-utils";

export function CurrencyStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge className={currencyStatusBadgeClass(status)}>
      {currencyStatusLabel(status, t("common.active"), t("common.inactive"))}
    </Badge>
  );
}
