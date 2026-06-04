"use client";

import { Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { CurrencyFlag } from "@/features/settings/shared/currency-flag";
import { OptionSettingsPage } from "@/features/settings/shared/option-settings-page";
import type { Currency, FetchCurrenciesParams, SaveCurrencyInput } from "@/services/currency";
import { useCurrencyStore } from "@/stores/currency-store";

export function CurrencySettingsPage() {
  const { t } = useTranslation();
  const title = t("settings.modules.currency.title");

  return (
    <OptionSettingsPage<Currency, SaveCurrencyInput, FetchCurrenciesParams>
      slug="currency"
      itemLabel={t("nav.currency")}
      title={title}
      cardTitle={t("settings.currencyList")}
      description={t("settings.modules.currency.description")}
      dialogContentClassName="sm:max-w-5xl"
      idKey="currency_uuid"
      nameKey="currency_name"
      icon={Coins}
      renderLeading={(row) => <CurrencyFlag code={row.currency_icon} label={row.currency_name} />}
      store={useCurrencyStore}
      fields={[
        { name: "currency_name", label: t("fields.currency_name"), required: true },
        { name: "currency_icon", label: t("fields.currency_icon"), required: true, type: "flag-code" },
        {
          name: "currency_status",
          label: t("fields.currency_status"),
          required: true,
          type: "select",
          options: [
            { label: t("common.active"), value: "1" },
            { label: t("common.inactive"), value: "2" }
          ]
        }
      ]}
      columns={[
        {
          key: "currency_icon",
          label: t("fields.currency_icon"),
          className: "text-muted-foreground"
        },
        {
          key: "currency_status",
          label: t("fields.currency_status"),
          render: (row) => (
            <Badge className={Number(row.currency_status ?? 1) === 1 ? "border-primary/25 bg-primary/10 text-primary" : undefined}>
              {Number(row.currency_status ?? 1) === 1 ? t("common.active") : t("common.inactive")}
            </Badge>
          )
        }
      ]}
    />
  );
}
