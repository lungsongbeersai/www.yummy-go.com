"use client";

import { isActiveStatus, StatusBadge } from "@/components/common/status-badge";
import { MapPin, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsListPageLayout } from "@/features/settings/shared/settings-list-page-layout";
import { SettingsEmptyRecords, SettingsRowActions } from "@/features/settings/shared/settings-shell";
import { SETTINGS_ACCENT } from "@/features/settings/shared/settings-tones";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Customer, FetchCustomersParams, SaveCustomerInput } from "@/services/customer";
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

function customerInitials(name: string) {
  const compact = name.trim().replace(/\s+/g, "");
  return (compact.slice(0, 2) || "C").toUpperCase();
}

// Initials in the settings accent, like the icon tiles on the other settings lists.
function CustomerAvatar({ name }: { name: string }) {
  return (
    <Avatar>
      <AvatarFallback className={SETTINGS_ACCENT.soft}>{customerInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

function MemberCodeBadge({ code }: { code: string }) {
  if (!code) return null;
  return (
    <Badge variant="secondary" className="tabular-nums" translate="no">
      {code}
    </Badge>
  );
}

function CustomerAddress({ row }: { row: Customer }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
      <MapPin aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{customerAddress(row)}</span>
    </span>
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

  const table = (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          <TableHead className="w-px">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => toggleAll(checked === true)} />
          </TableHead>
          {/* w-px: checkbox, number and actions shrink to their content. */}
          <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
          <TableHead className="min-w-56">{t("nav.customer")}</TableHead>
          <TableHead>{t("fields.customer_address")}</TableHead>
          <TableHead>{t("fields.customer_status")}</TableHead>
          <TableHead className="w-px">
            <span className="sr-only">{t("common.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const id = rowId(row);
          const name = customerName(row);
          const selected = selectedRows.has(id);
          return (
            <TableRow key={id || index} data-state={selected ? "selected" : undefined}>
              <TableCell>
                <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onCheckedChange={(checked) => toggleSelected(id, checked === true)} />
              </TableCell>
              <TableCell className="text-center text-muted-foreground tabular-nums">{pageStart + index}</TableCell>
              <TableCell>
                {/* The phone sits under the name (it identifies the customer) rather than in a column. */}
                <div className="flex items-center gap-3">
                  <CustomerAvatar name={name} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{name}</span>
                      <MemberCodeBadge code={customerMemberCode(row)} />
                    </span>
                    <span className="truncate text-muted-foreground tabular-nums" translate="no">
                      {customerPhone(row)}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-72">
                <CustomerAddress row={row} />
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
  );

  // Narrow pages: one Item per customer, two columns once there is room.
  const mobileList = (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">
      {rows.map((row, index) => {
        const id = rowId(row);
        const name = customerName(row);
        return (
          <Item key={id || index} variant="outline">
            <Checkbox aria-label={t("common.selectRow", { name })} checked={selectedRows.has(id)} onCheckedChange={(checked) => toggleSelected(id, checked === true)} />
            <ItemMedia>
              <CustomerAvatar name={name} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {name}
                <MemberCodeBadge code={customerMemberCode(row)} />
              </ItemTitle>
              <ItemDescription className="tabular-nums" translate="no">
                {customerPhone(row)}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
            </ItemActions>
            <ItemFooter className="flex-wrap">
              <CustomerAddress row={row} />
              <StatusBadge active={isActiveStatus(customerStatus(row))} />
            </ItemFooter>
          </Item>
        );
      })}
    </ItemGroup>
  );

  return (
    <SettingsListPageLayout
      id="customer"
      title={title}
      description={description}
      icon={Users}
      addLabel={`${t("actions.add")} ${t("nav.customer")}`}
      onAdd={openCreate}
      loading={fullLoading}
      loadingLabel={t("settings.loading", { title })}
      search={search}
      searching={backgroundLoading}
      searchingLabel={t("settings.refreshingCustomerList")}
      onSearchChange={setSearch}
      onSearchApply={applyFilters}
      orderBy={orderBy}
      onOrderChange={(nextOrder) => {
        setOrderBy(nextOrder);
        setPage(1);
      }}
      orderOptions={[
        { label: t("common.asc"), value: "ASC" },
        { label: t("common.desc"), value: "DESC" }
      ]}
      allSelected={allSelected}
      selectAllLabel={t("common.selectAll")}
      selectedCount={selectedRows.size}
      onToggleAll={toggleAll}
      hasRows={rows.length > 0}
      table={table}
      mobileList={mobileList}
      empty={<SettingsEmptyRecords icon={<Users aria-hidden />} title={title.toLowerCase()} />}
      page={page}
      pageStart={pageStart}
      pageEnd={pageEnd}
      total={total}
      totalPages={totalPages}
      limit={limit}
      onLimitChange={changeLimit}
      onPageChange={setPage}
    >
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
    </SettingsListPageLayout>
  );
}
