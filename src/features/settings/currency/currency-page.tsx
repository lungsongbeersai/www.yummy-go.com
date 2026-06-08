"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Check, CircleSlash2, Coins, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
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
import { CurrencyFlag, currencyFlagOptions, type CurrencyFlagOption } from "@/features/settings/shared/currency-flag";
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
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { cn } from "@/lib/utils";
import type { Currency, FetchCurrenciesParams } from "@/services/currency";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToastStore } from "@/stores/toast-store";
import {
  buildCurrencyPayload,
  currencyIcon,
  currencyId,
  currencyName,
  currencyStatus,
  currencyStatusLabel,
  currencyValue,
  missingCurrencyField
} from "@/features/settings/currency/currency-utils";

const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
const ORDER_OPTIONS: Array<{ labelKey: "asc" | "desc"; value: SortOrder }> = [
  { labelKey: "asc", value: "ASC" },
  { labelKey: "desc", value: "DESC" }
];

type FlagGroup = "all" | "asean" | "majorCurrency" | "europe" | "middleAfrica" | "americas" | "asiaPacific" | "other";
type DirectFlagGroup = Exclude<FlagGroup, "all" | "other">;

const FLAG_GROUPS: Array<{ value: FlagGroup; labelKey: string }> = [
  { value: "all", labelKey: "settings.flagGroups.all" },
  { value: "asean", labelKey: "settings.flagGroups.asean" },
  { value: "majorCurrency", labelKey: "settings.flagGroups.majorCurrency" },
  { value: "europe", labelKey: "settings.flagGroups.europe" },
  { value: "middleAfrica", labelKey: "settings.flagGroups.middleAfrica" },
  { value: "americas", labelKey: "settings.flagGroups.americas" },
  { value: "asiaPacific", labelKey: "settings.flagGroups.asiaPacific" },
  { value: "other", labelKey: "settings.flagGroups.other" }
];

const DIRECT_FLAG_GROUPS: DirectFlagGroup[] = ["asean", "majorCurrency", "europe", "middleAfrica", "americas", "asiaPacific"];

const FLAG_GROUP_CODES: Record<DirectFlagGroup, Set<string>> = {
  asean: new Set(["LA", "TH", "VN", "MM", "KH", "SG", "MY", "ID", "PH", "BN", "TL"]),
  majorCurrency: new Set(["US", "EU", "GB", "JP", "CN", "KR", "IN", "RU", "TR", "AU", "CA", "CH", "HK", "TW", "SA", "AE", "BR", "MX", "ZA", "NG"]),
  europe: new Set([
    "AD", "AL", "AM", "AT", "AX", "AZ", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FO", "FR", "GB", "GE", "GG", "GI", "GR", "HR", "HU", "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SJ", "SK", "SM", "UA", "VA", "EU"
  ]),
  middleAfrica: new Set([
    "AE", "AF", "AO", "BF", "BH", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ", "DZ", "EG", "EH", "ER", "ET", "GA", "GH", "GM", "GN", "GQ", "GW", "IL", "IO", "IQ", "IR", "JO", "KE", "KM", "KW", "LB", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW", "MZ", "NA", "NE", "NG", "OM", "PK", "PS", "QA", "RW", "SA", "SC", "SD", "SL", "SN", "SO", "SS", "ST", "SY", "SZ", "TD", "TG", "TN", "TZ", "UG", "YE", "ZA", "ZM", "ZW"
  ]),
  americas: new Set([
    "AG", "AI", "AR", "AW", "BB", "BM", "BO", "BR", "BS", "BZ", "CA", "CL", "CO", "CR", "CU", "DM", "DO", "EC", "GD", "GL", "GT", "GY", "HN", "HT", "JM", "KN", "KY", "LC", "MX", "NI", "PA", "PE", "PR", "PY", "SR", "SV", "TT", "US", "UY", "VE"
  ]),
  asiaPacific: new Set([
    "AU", "BD", "BT", "CN", "FJ", "HK", "ID", "IN", "JP", "KG", "KH", "KR", "KZ", "LA", "LK", "MN", "MO", "MV", "MY", "NP", "NZ", "PH", "PK", "SG", "TH", "TJ", "TM", "TW", "UZ", "VN", "WS"
  ])
};

function flagGroup(option: CurrencyFlagOption): FlagGroup {
  if (option.custom) return "other";
  for (const group of DIRECT_FLAG_GROUPS) {
    if (FLAG_GROUP_CODES[group].has(option.code)) return group;
  }
  return "other";
}

function activeBadgeClass(status: string) {
  return Number(status || 1) === 1
    ? "border-primary/25 bg-primary/10 text-primary"
    : "border-muted-foreground/20 bg-muted text-muted-foreground";
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge className={activeBadgeClass(status)}>
      {currencyStatusLabel(status, t("common.active"), t("common.inactive"))}
    </Badge>
  );
}

function CurrencyCodeBadge({ code }: { code: string }) {
  return (
    <Badge className="max-w-full border-primary/20 bg-primary/10 text-primary" translate="no">
      {code || "-"}
    </Badge>
  );
}

function CurrencyIdentity({ row }: { row: Currency }) {
  const name = currencyName(row);
  const icon = currencyIcon(row);
  const id = currencyId(row);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <CurrencyFlag code={icon} label={name} />
      <div className="min-w-0">
        <p className="truncate font-black">{name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" translate="no">
          {[icon !== "-" ? icon : "", id].filter(Boolean).join(" / ") || "-"}
        </p>
      </div>
    </div>
  );
}

export function CurrencySettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);
  const rows = useCurrencyStore((state) => state.rows);
  const total = useCurrencyStore((state) => state.total);
  const storeTotalPages = useCurrencyStore((state) => state.totalPages);
  const search = useCurrencyStore((state) => state.search);
  const hasLoaded = useCurrencyStore((state) => state.hasLoaded);
  const loading = useCurrencyStore((state) => state.loading);
  const refreshing = useCurrencyStore((state) => state.refreshing);
  const saving = useCurrencyStore((state) => state.saving);
  const setSearch = useCurrencyStore((state) => state.setSearch);
  const loadRows = useCurrencyStore((state) => state.load);
  const saveRow = useCurrencyStore((state) => state.save);
  const removeRow = useCurrencyStore((state) => state.remove);
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Currency | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Currency | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());

  const title = t("settings.modules.currency.title");
  const description = t("settings.modules.currency.description");
  const requestParams = useMemo<FetchCurrenciesParams>(
    () => ({
      search,
      page,
      limit,
      orderBy,
      lang: language
    }),
    [language, limit, orderBy, page, search]
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
  const ids = useMemo(() => rows.map(currencyId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  async function load() {
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
  }, [language, page, limit, orderBy]);

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
    else resetPage();
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
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Currency) {
    setEditing(row);
    setDialogOpen(true);
  }

  function missingFieldDescription(field: ReturnType<typeof missingCurrencyField>) {
    if (field === "name") return t("settings.currencyNameRequired");
    if (field === "flag") return t("settings.currencyFlagRequired");
    if (field === "status") return t("settings.currencyStatusRequired");
    return t("toasts.pleaseTryAgain");
  }

  async function save(formData: FormData) {
    const name = String(formData.get("currency_name") ?? "").trim();
    const icon = String(formData.get("currency_icon") ?? "").trim();
    const status = String(formData.get("currency_status") ?? "").trim();
    const missing = missingCurrencyField({ icon, name, status });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveRow(buildCurrencyPayload({ editing, icon, name, status }));
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

  async function remove(row: Currency) {
    const id = currencyId(row);
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
      <Table className="min-w-[860px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{t("nav.currency")}</TableHead>
            <TableHead>{t("fields.currency_icon")}</TableHead>
            <TableHead>{t("fields.currency_status")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = currencyId(row);
            const name = currencyName(row);
            const icon = currencyIcon(row);
            const selected = selectedRows.has(id);
            return (
              <TableRow key={id || index} className="h-14" data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell className="max-w-[30rem]">
                  <CurrencyIdentity row={row} />
                </TableCell>
                <TableCell>
                  <CurrencyCodeBadge code={icon} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={currencyStatus(row)} />
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
        const id = currencyId(row);
        const name = currencyName(row);
        const icon = currencyIcon(row);
        const selected = selectedRows.has(id);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            badges={<CurrencyCodeBadge code={icon} />}
            checked={selected}
            leading={<CurrencyFlag code={icon} label={name} />}
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={
              <span className="block truncate" translate="no">
                {id || "-"}
              </span>
            }
            title={name}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.currency_status")} value={<StatusBadge status={currencyStatus(row)} />} />
              <SettingsMobileMeta
                label={t("fields.currency_icon")}
                value={
                  <span translate="no">
                    {icon}
                  </span>
                }
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
            <p className="text-sm font-black">{t("settings.currencyList")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingCurrencyList")}
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
                <Coins aria-hidden />
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
        addLabel={`${t("actions.add")} ${t("nav.currency")}`}
        cardTitle={t("settings.currencyList")}
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
      <CurrencyFormDialog
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
        confirmPending={saving}
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

function CurrencyFormDialog({
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving
}: {
  editing: Currency | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [status, setStatus] = useState("1");
  const formKey = currencyId(editing) || "new-currency";
  const saveDisabled = saving || !name.trim() || !icon.trim() || !status.trim();

  useEffect(() => {
    setName(currencyValue(editing, "currency_name"));
    setIcon(currencyIcon(editing) === "-" ? "" : currencyIcon(editing));
    setStatus(currencyStatus(editing));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-5xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {t("settings.modules.currency.title")}</DialogTitle>
            <DialogDescription>{t("settings.currencyFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.currencyDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.currencyDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="currency-name">{t("fields.currency_name")}</FieldLabel>
                    <Input
                      id="currency-name"
                      name="currency_name"
                      autoComplete="off"
                      disabled={saving}
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="currency-status">{t("fields.currency_status")}</FieldLabel>
                    <input name="currency_status" type="hidden" value={status} />
                    <Select required value={status} onValueChange={setStatus}>
                      <SelectTrigger id="currency-status" className="w-full" disabled={saving}>
                        <SelectValue placeholder={t("fields.currency_status")} />
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
                  <FieldLegend>{t("settings.currencyFlagStatus")}</FieldLegend>
                  <FieldDescription>{t("settings.currencyFlagStatusHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="currency-icon">{t("fields.currency_icon")}</FieldLabel>
                  <CurrencyFlagPicker
                    code={icon}
                    disabled={saving}
                    id="currency-icon"
                    name="currency_icon"
                    required
                    onChange={setIcon}
                  />
                </Field>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="currency_uuid" type="hidden" value={currencyId(editing)} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saveDisabled} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}

function CurrencyFlagPicker({
  code,
  disabled,
  id,
  name,
  onChange,
  required
}: {
  code: string;
  disabled?: boolean;
  id: string;
  name: string;
  onChange: (code: string) => void;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const options = useMemo(() => currencyFlagOptions(language, code), [code, language]);
  const [activeGroup, setActiveGroup] = useState<FlagGroup>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const selected = options.find((option) => option.code === code) ?? options[0];
  const groupOptions = useMemo(
    () => (activeGroup === "all" ? options : options.filter((option) => flagGroup(option) === activeGroup)),
    [activeGroup, options]
  );
  const filteredOptions = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return groupOptions;
    return groupOptions.filter((option) => option.searchText.includes(query));
  }, [deferredSearch, groupOptions]);

  useEffect(() => {
    setActiveGroup("all");
    setSearch("");
  }, [code]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <input aria-required={required} id={id} name={name} type="hidden" value={code} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <CurrencyFlag className="size-12 rounded-md" code={selected?.code ?? code} label={selected?.label ?? code} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{t("settings.selectedFlag")}</p>
            <p className="truncate text-sm font-semibold text-foreground">{selected?.label || t("settings.selectFlag")}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground" translate="no">{selected?.code || code || "-"}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
              {t(FLAG_GROUPS.find((group) => group.value === activeGroup)?.labelKey ?? "settings.flagGroups.all")}
            </span>
            <Badge className="h-6 min-w-14 justify-center rounded-md bg-primary/10 px-2.5 text-primary">
              {filteredOptions.length} / {groupOptions.length}
            </Badge>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Search aria-hidden />
            </span>
            <Input
              id={`${id}-search`}
              name={`${name}_search`}
              autoComplete="off"
              className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              disabled={disabled}
              placeholder={t("settings.searchFlags")}
              spellCheck={false}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <Button aria-label={t("actions.clear")} disabled={disabled} size="iconSm" type="button" variant="ghost" onClick={() => setSearch("")}>
                <X aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FLAG_GROUPS.map((group) => {
          const isActive = activeGroup === group.value;
          return (
            <Button
              key={group.value}
              aria-pressed={isActive}
              className="shrink-0"
              disabled={disabled}
              size="sm"
              type="button"
              variant={isActive ? "default" : "outline"}
              onClick={() => setActiveGroup(group.value)}
            >
              {t(group.labelKey)}
            </Button>
          );
        })}
      </div>

      <div className="max-h-[20rem] overflow-y-auto rounded-lg border border-border bg-background p-2" role="listbox">
        {filteredOptions.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOptions.map((option) => {
              const isActive = option.code === code;
              return (
                <Button
                  key={option.code}
                  aria-selected={isActive}
                  className={cn(
                    "h-auto min-h-14 justify-start gap-3 px-3 py-2 text-left shadow-sm",
                    isActive && "border-primary bg-primary/10 text-foreground ring-2 ring-primary/15"
                  )}
                  disabled={disabled}
                  role="option"
                  title={`${option.code} ${option.label}`}
                  type="button"
                  variant="outline"
                  onClick={() => onChange(option.code)}
                >
                  <CurrencyFlag className={cn("size-9 rounded-md", isActive && "ring-1 ring-primary/25")} code={option.code} label={option.label} />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground" translate="no">{option.code}</span>
                  </span>
                  {option.custom ? <span className="hidden text-xs text-muted-foreground lg:inline">{t("settings.customFlag")}</span> : null}
                  {isActive ? <Check aria-hidden data-icon="inline-end" /> : null}
                </Button>
              );
            })}
          </div>
        ) : (
          <Empty className="min-h-40 border border-dashed bg-muted/30 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
                <CircleSlash2 aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noFlagsFound")}</EmptyTitle>
              <EmptyDescription>{t("settings.tryDifferentFlagSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
