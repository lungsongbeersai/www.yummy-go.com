"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { CurrencyFlag } from "@/features/settings/shared/currency-flag";
import type { Currency } from "@/services/currency";
import {
  currencyIcon,
  currencyName,
  currencyStatusBadgeClass,
  currencyStatusLabel
} from "./currency-utils";

export function CurrencyStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge className={currencyStatusBadgeClass(status)}>
      {currencyStatusLabel(status, t("common.active"), t("common.inactive"))}
    </Badge>
  );
}

export function CurrencyCodeBadge({ code }: { code: string }) {
  return (
    <Badge className="max-w-full border-primary/20 bg-primary/10 text-primary" translate="no">
      {code || "-"}
    </Badge>
  );
}

export function CurrencyIdentity({ row }: { row: Currency }) {
  const name = currencyName(row);
  const icon = currencyIcon(row);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <CurrencyFlag code={icon} label={name} />
      <div className="min-w-0">
        <p className="truncate font-black">{name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" translate="no">
          {icon !== "-" ? icon : "-"}
        </p>
      </div>
    </div>
  );
}
