"use client";

import { isActiveStatus, StatusBadge } from "@/components/common/status-badge";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsCrudShell, SettingsCrudToolbar } from "@/features/settings/shared/settings-crud-shell";
import {
  SettingsListSurface,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
} from "@/features/settings/shared/settings-shell";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Customer, FetchCustomersParams, SaveCustomerInput } from "@/services/customer";
import type { SortOrder } from "@/services/shared/types";
import { useCustomerStore } from "@/stores/customer-store";
import { CustomerFormDialog } from "./customer-form-dialog";
import {
  customerAddress,
  customerFormInput,
  customerMemberCode,
  customerName,
  customerPhone,
  customerStatus
} from "./customer-utils";

const ORDER_OPTIONS: Array<{ labelKey: "asc" | "desc"; value: SortOrder }> = [
  { labelKey: "asc", value: "ASC" },
  { labelKey: "desc", value: "DESC" }
];

function customerInitials(name: string) {
  const compact = name.trim().replace(/\s+/g, "");
  return (compact.slice(0, 2) || "C").toUpperCase();
}

function CustomerAvatar({ name }: { name: string }) {
  return (
    <Avatar size="lg">
      <AvatarFallback className="bg-primary/10 font-black text-primary">
        {customerInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function MemberCodeBadge({ code }: { code: string }) {
  if (!code) return null;
  return (
    <Badge className="max-w-full shrink-0 border-primary/20 bg-primary/10 text-primary" translate="no">
      {code}
    </Badge>
  );
}

function CustomerIdentity({ row }: { row: Customer }) {
  const name = customerName(row);
  const code = customerMemberCode(row);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <CustomerAvatar name={name} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 truncate font-black">{name}</p>
          <MemberCodeBadge code={code} />
        </div>
      </div>
    </div>
  );
}

export function CustomerSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const title = t("settings.modules.customer.title");
  const description = t("settings.modules.customer.description");
  const listTitle = t("settings.customerList");
  const controller = useSettingsCrudController<Customer, SaveCustomerInput, FetchCustomersParams>({
    buildInput: ({ editing: editingRow, formData, storeUuid }) => customerFormInput(formData, storeUuid, editingRow),
    idKey: "customer_uuid",
    initialPagination,
    requiredScopeKey: "store_uuid_fk",
    requiredScopeMessage: t("settings.storeRequired"),
    scope: (storeUuid) => ({ store_uuid_fk: storeUuid }),
    store: useCustomerStore,
    title,
    validateInput: ({ formData }) => {
      const name = String(formData.get("customer_name") ?? "").trim();
      if (!name) return t("settings.customerNameRequired");
      return null;
    }
  });
  const { allSelected, openEdit, pageStart, rowId, rows, selectedRows, setDeleteTarget, toggleAll, toggleSelected } =
    controller;

  const table = rows.length ? (
    <SettingsTableScroll>
      <Table className="min-w-[1040px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{t("nav.customer")}</TableHead>
            <TableHead>{t("fields.customer_phone")}</TableHead>
            <TableHead>{t("fields.customer_address")}</TableHead>
            <TableHead>{t("fields.customer_status")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = rowId(row);
            const name = customerName(row);
            const selected = selectedRows.has(id);
            return (
              <TableRow key={id || index} className="h-14" data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell className="max-w-[28rem]">
                  <CustomerIdentity row={row} />
                </TableCell>
                <TableCell className="max-w-56">
                  <span className="block truncate text-muted-foreground" translate="no">
                    {customerPhone(row)}
                  </span>
                </TableCell>
                <TableCell className="max-w-[24rem]">
                  <span className="line-clamp-2 break-words text-muted-foreground">
                    {customerAddress(row)}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge active={isActiveStatus(customerStatus(row))} />
                </TableCell>
                <TableCell className="text-right">
                  <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SettingsTableScroll>
  ) : null;

  const mobileList = rows.length ? (
    <SettingsMobileList>
      {rows.map((row, index) => {
        const id = rowId(row);
        const name = customerName(row);
        const code = customerMemberCode(row);
        const selected = selectedRows.has(id);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            badges={<MemberCodeBadge code={code} />}
            checked={selected}
            leading={<CustomerAvatar name={name} />}
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={
              <span className="block truncate" translate="no">
                {customerPhone(row)}
              </span>
            }
            title={name}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta
                label={t("fields.customer_status")}
                value={<StatusBadge active={isActiveStatus(customerStatus(row))} />}
              />
              <SettingsMobileMeta
                label={t("fields.customer_address")}
                value={<span className="line-clamp-3 break-words">{customerAddress(row)}</span>}
              />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

  return (
    <SettingsCrudShell
      addLabel={`${t("actions.add")} ${t("nav.customer")}`}
      cardTitle={listTitle}
      controller={controller}
      description={description}
      formDialog={
        <CustomerFormDialog
          editing={controller.editing}
          open={controller.dialogOpen}
          saving={controller.saving}
          onOpenChange={controller.onDialogOpenChange}
          onSubmit={controller.save}
        />
      }
      listSurface={
        <SettingsListSurface
          backgroundLoading={controller.backgroundLoading}
          emptyIcon={<Users aria-hidden />}
          emptyTitle={title.toLowerCase()}
          hasRows={rows.length > 0}
          listTitle={listTitle}
          mobileList={mobileList}
          refreshLabel={t("settings.refreshingCustomerList")}
          table={table}
          toolbar={
            <SettingsCrudToolbar
              controller={controller}
              limitOptions={PAGE_LIMIT_OPTIONS}
              orderOptions={ORDER_OPTIONS.map((option) => ({ label: t(`common.${option.labelKey}`), value: option.value }))}
            />
          }
        />
      }
      title={title}
    />
  );
}
