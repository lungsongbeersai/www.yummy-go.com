"use client";

import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { OptionSettingsPage } from "@/features/settings/shared/option-settings-page";
import type { Customer, FetchCustomersParams, SaveCustomerInput } from "@/services/customer";
import { useCustomerStore } from "@/stores/customer-store";

const customerScope = (storeUuid: string) => ({ store_uuid_fk: storeUuid });

export function CustomerSettingsPage() {
  const { t } = useTranslation();
  const title = t("settings.modules.customer.title");
  const statusOptions = [
    { label: t("common.active"), value: "1" },
    { label: t("common.inactive"), value: "2" }
  ];

  return (
    <OptionSettingsPage<Customer, SaveCustomerInput, FetchCustomersParams>
      slug="customer"
      itemLabel={t("nav.customer")}
      title={title}
      cardTitle={t("settings.customerList")}
      description={t("settings.modules.customer.description")}
      idKey="customer_uuid"
      nameKey="customer_name"
      icon={Users}
      store={useCustomerStore}
      scope={customerScope}
      requiredScopeKey="store_uuid_fk"
      requiredScopeMessage={t("settings.storeRequired")}
      tableClassName="min-w-[1040px]"
      fields={[
        { name: "member_code", label: t("fields.member_code") },
        { name: "customer_name", label: t("fields.customer_name"), required: true },
        { name: "customer_phone", label: t("fields.customer_phone") },
        { name: "customer_status", label: t("fields.customer_status"), type: "select", options: statusOptions },
        { name: "customer_address", label: t("fields.customer_address"), type: "textarea" }
      ]}
      columns={[
        { key: "member_code", label: t("fields.member_code"), className: "whitespace-nowrap text-muted-foreground" },
        { key: "customer_phone", label: t("fields.customer_phone"), className: "whitespace-nowrap text-muted-foreground" },
        {
          key: "customer_status",
          label: t("fields.customer_status"),
          render: (row) => {
            const active = Number(row.customer_status ?? 1) === 1;
            return <Badge className={active ? "border-primary/25 bg-primary/10 text-primary" : undefined}>{active ? t("common.active") : t("common.inactive")}</Badge>;
          }
        },
        { key: "customer_address", label: t("fields.customer_address"), className: "max-w-80 truncate text-muted-foreground" }
      ]}
    />
  );
}
