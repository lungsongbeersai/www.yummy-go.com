"use client";

import { Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CurrencyFlag } from "@/features/settings/shared/currency-flag";
import { ColorCodeBadge, OptionSettingsPage, type OptionSaveArgs } from "@/features/settings/shared/option-settings-page";
import { buildCurrencyPayload, currencyIcon, currencyName, currencyStatus, missingCurrencyField } from "@/features/settings/currency/currency-utils";
import { CurrencyStatusBadge } from "@/features/settings/currency/currency-display";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Currency, FetchCurrenciesParams, SaveCurrencyInput } from "@/services/currency";
import { useCurrencyStore } from "@/stores/currency-store";

function currencySaveArgs({ editing, formData }: OptionSaveArgs<Currency>) {
  return {
    editing,
    icon: String(formData.get("currency_icon") ?? "").trim(),
    name: String(formData.get("currency_name") ?? "").trim(),
    status: String(formData.get("currency_status") ?? "").trim()
  };
}

export function CurrencySettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();

  return (
    <OptionSettingsPage<Currency, SaveCurrencyInput, FetchCurrenciesParams>
      buildInput={(args) => buildCurrencyPayload(currencySaveArgs(args))}
      columns={[
        {
          key: "currency_icon",
          label: t("fields.currency_icon"),
          render: (row) => <ColorCodeBadge code={currencyIcon(row)} />
        },
        {
          key: "currency_status",
          label: t("fields.currency_status"),
          render: (row) => <CurrencyStatusBadge status={currencyStatus(row)} />
        }
      ]}
      description={t("settings.modules.currency.description")}
      dialogContentClassName="sm:max-w-5xl"
      fields={[
        { name: "currency_name", label: t("fields.currency_name"), required: true },
        {
          name: "currency_status",
          label: t("fields.currency_status"),
          required: true,
          type: "select",
          options: [
            { label: t("common.active"), value: "1" },
            { label: t("common.inactive"), value: "2" }
          ]
        },
        { name: "currency_icon", label: t("fields.currency_icon"), required: true, type: "flag-code" }
      ]}
      formDescription={t("settings.currencyDetailsHint")}
      formTitle={t("settings.currencyDetails")}
      getName={currencyName}
      getSubtitle={(row) => {
        const icon = currencyIcon(row);
        return (
          <span className="block truncate" translate="no">
            {icon !== "-" ? icon : "-"}
          </span>
        );
      }}
      icon={Coins}
      idKey="currency_uuid"
      initialPagination={initialPagination}
      itemLabel={t("nav.currency")}
      listTitle={t("settings.currencyList")}
      nameKey="currency_name"
      refreshLabel={t("settings.refreshingCurrencyList")}
      renderBadges={(row) => <ColorCodeBadge code={currencyIcon(row)} />}
      renderLeading={(row) => <CurrencyFlag code={currencyIcon(row)} label={currencyName(row)} />}
      slug="currency"
      store={useCurrencyStore}
      tableClassName="min-w-[860px]"
      title={t("settings.modules.currency.title")}
      validateInput={(args) => {
        const missing = missingCurrencyField(currencySaveArgs(args));
        if (missing === "name") return t("settings.currencyNameRequired");
        if (missing === "flag") return t("settings.currencyFlagRequired");
        if (missing === "status") return t("settings.currencyStatusRequired");
        return null;
      }}
    />
  );
}
