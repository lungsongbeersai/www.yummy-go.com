"use client";

import { isActiveStatus, StatusBadge } from "@/components/common/status-badge";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar,
  SettingsEmptyRecords,} from "@/features/settings/shared/settings-shell";
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
  const {
    allSelected,
    applyFilters,
    backgroundLoading,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    limit,
    onDialogOpenChange,
    openCreate,
    openEdit,
    orderBy,
    page,
    pageEnd,
    pageStart,
    remove,
    rowId,
    rows,
    save,
    saving,
    search,
    selectedRows,
    setDeleteTarget,
    setOrderBy,
    setPage,
    setSearch,
    toggleAll,
    toggleSelected,
    total,
    totalPages
  } = useSettingsCrudController<Customer, SaveCustomerInput, FetchCustomersParams>({
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

  const table = rows.length ? (
    <SettingsTableScroll>
      <Table className="min-w-[1040px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => toggleAll(checked as boolean)} />
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
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onCheckedChange={(checked) => toggleSelected(id, checked as boolean)} />
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

  const toolbar = (
    <SettingsToolbar
      state={{
        search,
        limit,
        orderBy,
        limitOptions: PAGE_LIMIT_OPTIONS,
        orderOptions: ORDER_OPTIONS.map((option) => ({ label: t(`common.${option.labelKey}`), value: option.value })),
        selectedCount: selectedRows.size,
        onApply: applyFilters,
        onLimit: changeLimit,
        onOrder: (nextOrder) => {
          setOrderBy(nextOrder);
          setPage(1);
        },
        onSearch: setSearch
      }}
    />
  );

  const listSurface = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{t("settings.customerList")}</p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingCustomerList")}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">{table}</div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">{mobileList}</div>
        </>
      ) : (
        <SettingsEmptyRecords icon={<Users aria-hidden />} title={title.toLowerCase()} />
      )}
    </div>
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${t("nav.customer")}`}
        cardTitle={t("settings.customerList")}
        description={description}
        emptyDescription={t("empty.adjustSearch")}
        emptyTitle={t("settings.noRecords", { title: title.toLowerCase() })}
        footer={
          rows.length ? (
            <SettingsPaginationFooter
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : undefined
        }
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={listSurface}
        title={title}
        onAdd={openCreate}
      />
      <CustomerFormDialog
        editing={editing}
        open={dialogOpen}
        saving={saving}
        onOpenChange={onDialogOpenChange}
        onSubmit={save}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        description={t("settings.deleteConfirm")}
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </>
  );
}
