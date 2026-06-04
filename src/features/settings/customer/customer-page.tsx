"use client";

import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { Customer, FetchCustomersParams, SaveCustomerInput } from "@/services/customer";
import type { ApiEntity, PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useToastStore } from "@/stores/toast-store";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
const ORDER_OPTIONS: Array<{ labelKey: "asc" | "desc"; value: SortOrder }> = [
  { labelKey: "asc", value: "ASC" },
  { labelKey: "desc", value: "DESC" }
];

function value(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

function customerId(row: Customer | null | undefined) {
  return value(row, "customer_uuid");
}

function customerName(row: Customer | null | undefined) {
  return value(row, "customer_name", "-");
}

function customerMemberCode(row: Customer | null | undefined) {
  return value(row, "member_code");
}

function customerPhone(row: Customer | null | undefined) {
  return value(row, "customer_phone", "-");
}

function customerAddress(row: Customer | null | undefined) {
  return value(row, "customer_address", "-");
}

function customerStatus(row: Customer | null | undefined) {
  return value(row, "customer_status", "1");
}

function customerInitials(name: string) {
  const compact = name.trim().replace(/\s+/g, "");
  return (compact.slice(0, 2) || "C").toUpperCase();
}

function activeLabel(status: string, active: string, inactive: string) {
  return Number(status || 1) === 1 ? active : inactive;
}

function activeBadgeClass(status: string) {
  return Number(status || 1) === 1
    ? "border-primary/25 bg-primary/10 text-primary"
    : "border-muted-foreground/20 bg-muted text-muted-foreground";
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

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge className={activeBadgeClass(status)}>
      {activeLabel(status, t("common.active"), t("common.inactive"))}
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

export function CustomerSettingsPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const rows = useCustomerStore((state) => state.rows);
  const total = useCustomerStore((state) => state.total);
  const storeTotalPages = useCustomerStore((state) => state.totalPages);
  const search = useCustomerStore((state) => state.search);
  const hasLoaded = useCustomerStore((state) => state.hasLoaded);
  const loading = useCustomerStore((state) => state.loading);
  const refreshing = useCustomerStore((state) => state.refreshing);
  const saving = useCustomerStore((state) => state.saving);
  const setSearch = useCustomerStore((state) => state.setSearch);
  const loadRows = useCustomerStore((state) => state.load);
  const saveRow = useCustomerStore((state) => state.save);
  const removeRow = useCustomerStore((state) => state.remove);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());

  const title = t("settings.modules.customer.title");
  const description = t("settings.modules.customer.description");
  const requestParams = useMemo<FetchCustomersParams>(
    () => ({
      search,
      page,
      limit,
      orderBy,
      lang: language,
      store_uuid_fk: storeUuid
    }),
    [language, limit, orderBy, page, search, storeUuid]
  );
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const ids = useMemo(() => rows.map(customerId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  async function load() {
    if (!storeUuid) {
      showToast({ title: t("settings.loadFailed", { title }), description: t("settings.storeRequired"), tone: "error" });
      return;
    }

    try {
      await loadRows(requestParams, { background: hasLoaded });
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, page, limit, orderBy, storeUuid]);

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(ids);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [ids]);

  function applyFilters() {
    if (page === 1) void load();
    else setPage(1);
  }

  function toggleSelected(id: string, checked: boolean) {
    if (!id) return;
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedRows(checked ? new Set(ids) : new Set());
  }

  function openCreate() {
    if (!storeUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.storeRequired"), tone: "error" });
      return;
    }

    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Customer) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function save(formData: FormData) {
    const id = customerId(editing);
    const name = String(formData.get("customer_name") ?? "").trim();

    if (!storeUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.storeRequired"), tone: "error" });
      return;
    }
    if (!name) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.customerNameRequired"), tone: "error" });
      return;
    }

    const input: SaveCustomerInput = {
      store_uuid_fk: storeUuid,
      member_code: String(formData.get("member_code") ?? "").trim(),
      customer_name: name,
      customer_phone: String(formData.get("customer_phone") ?? "").trim(),
      customer_address: String(formData.get("customer_address") ?? "").trim(),
      customer_status: Number(formData.get("customer_status") ?? 1)
    };
    if (id) input.customer_uuid = id;

    try {
      await saveRow(input);
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: Customer) {
    const id = customerId(row);
    if (!id) return;

    try {
      await removeRow(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

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
            const id = customerId(row);
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
                  <StatusBadge status={customerStatus(row)} />
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
        const id = customerId(row);
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
                value={<StatusBadge status={customerStatus(row)} />}
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
        onLimit: (nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        },
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
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
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
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noRecords", { title: title.toLowerCase() })}</EmptyTitle>
              <EmptyDescription>{t("empty.adjustSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
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
              canGoBack={canGoBack}
              canGoNext={canGoNext}
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onBack={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
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
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setDialogOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
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

function CustomerFormDialog({
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving
}: {
  editing: Customer | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState("1");
  const formKey = customerId(editing) || "new-customer";

  useEffect(() => {
    setStatus(customerStatus(editing));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-2xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {t("settings.modules.customer.title")}</DialogTitle>
            <DialogDescription>{t("settings.customerFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.customerDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.customerDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="customer-member-code">{t("fields.member_code")}</FieldLabel>
                    <Input
                      id="customer-member-code"
                      name="member_code"
                      autoComplete="off"
                      defaultValue={customerMemberCode(editing)}
                      disabled={saving}
                      spellCheck={false}
                      translate="no"
                    />
                    <FieldDescription>{t("settings.memberCodeHint")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="customer-name">{t("fields.customer_name")}</FieldLabel>
                    <Input
                      id="customer-name"
                      name="customer_name"
                      autoComplete="name"
                      defaultValue={value(editing, "customer_name")}
                      disabled={saving}
                      required
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="customer-status">{t("fields.customer_status")}</FieldLabel>
                    <input name="customer_status" type="hidden" value={status} />
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="customer-status" className="w-full" disabled={saving}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          <SelectItem value="1">{t("common.active")}</SelectItem>
                          <SelectItem value="2">{t("common.inactive")}</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.customerContactDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.customerContactDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="customer-phone">{t("fields.customer_phone")}</FieldLabel>
                    <Input
                      id="customer-phone"
                      name="customer_phone"
                      autoComplete="tel"
                      defaultValue={value(editing, "customer_phone")}
                      disabled={saving}
                      inputMode="tel"
                      type="tel"
                      translate="no"
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="customer-address">{t("fields.customer_address")}</FieldLabel>
                    <Textarea
                      id="customer-address"
                      name="customer_address"
                      autoComplete="street-address"
                      defaultValue={value(editing, "customer_address")}
                      disabled={saving}
                      rows={4}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="customer_uuid" type="hidden" value={customerId(editing)} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
