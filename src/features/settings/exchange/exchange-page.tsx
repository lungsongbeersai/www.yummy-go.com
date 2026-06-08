"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins } from "lucide-react";
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
import { CurrencyFlag } from "@/features/settings/shared/currency-flag";
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
import type { Currency } from "@/services/currency";
import type { Exchange, FetchExchangesParams } from "@/services/exchange";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useExchangeStore } from "@/stores/exchange-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import {
  buildExchangePayload,
  currencyIcon,
  currencyId,
  currencyName,
  currencyOptionLabel,
  exchangeId,
  exchangeRate,
  exchangeStatus,
  exchangeStatusLabel,
  exchangeValue,
  missingExchangeField
} from "./exchange-utils";

const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
const ORDER_OPTIONS: Array<{ labelKey: "asc" | "desc"; value: SortOrder }> = [
  { labelKey: "asc", value: "ASC" },
  { labelKey: "desc", value: "DESC" }
];

function activeBadgeClass(status: string) {
  return Number(status || 1) === 1
    ? "border-primary/25 bg-primary/10 text-primary"
    : "border-muted-foreground/20 bg-muted text-muted-foreground";
}

function RateBadge({ rate }: { rate: string }) {
  return (
    <Badge className="border-primary/20 bg-primary/10 text-primary" translate="no">
      {rate}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge className={activeBadgeClass(status)}>
      {exchangeStatusLabel(status, t("common.active"), t("common.inactive"))}
    </Badge>
  );
}

function CurrencyOptionContent({ currency }: { currency: Currency }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <CurrencyFlag code={exchangeValue(currency, "currency_icon")} label={exchangeValue(currency, "currency_name")} small />
      <span className="truncate">{currencyOptionLabel(currency)}</span>
    </span>
  );
}

function CurrencyIdentity({
  currencyById,
  row
}: {
  currencyById: Map<string, Currency>;
  row: Exchange;
}) {
  const name = currencyName(row, currencyById);
  const icon = currencyIcon(row, currencyById);
  const id = currencyId(row);
  const meta = [icon !== "-" ? icon : "", id].filter(Boolean).join(" / ");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <CurrencyFlag code={icon} label={name} />
      <div className="min-w-0">
        <p className="truncate font-black">{name}</p>
        {meta ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground" translate="no">
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ExchangeSettingsPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const rows = useExchangeStore((state) => state.rows);
  const total = useExchangeStore((state) => state.total);
  const storeTotalPages = useExchangeStore((state) => state.totalPages);
  const search = useExchangeStore((state) => state.search);
  const hasLoaded = useExchangeStore((state) => state.hasLoaded);
  const loading = useExchangeStore((state) => state.loading);
  const refreshing = useExchangeStore((state) => state.refreshing);
  const saving = useExchangeStore((state) => state.saving);
  const setSearch = useExchangeStore((state) => state.setSearch);
  const loadRows = useExchangeStore((state) => state.load);
  const saveRow = useExchangeStore((state) => state.save);
  const removeRow = useExchangeStore((state) => state.remove);
  const loadCurrencyOptions = useReferenceStore((state) => state.loadCurrencies);
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Exchange | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exchange | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [currencyOptions, setCurrencyOptions] = useState<Currency[]>([]);

  const title = t("settings.modules.exchange.title");
  const description = t("settings.modules.exchange.description");
  const requestParams = useMemo<FetchExchangesParams>(
    () => ({ search, page, limit, orderBy, lang: language, store_uuid_fk: storeUuid }),
    [language, limit, orderBy, page, search, storeUuid]
  );
  const currencyById = useMemo(() => {
    const map = new Map<string, Currency>();
    currencyOptions.forEach((currency) => {
      const id = currencyId(currency);
      if (id) map.set(id, currency);
    });
    return map;
  }, [currencyOptions]);
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const ids = useMemo(() => rows.map(exchangeId).filter(Boolean), [rows]);
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
  }, [storeUuid, language, page, limit, orderBy]);

  useEffect(() => {
    let active = true;
    loadCurrencyOptions()
      .then((currencies) => {
        if (active) setCurrencyOptions(currencies);
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("settings.modules.currency.title") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [loadCurrencyOptions, showToast, t]);

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
    if (!storeUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.storeRequired"), tone: "error" });
      return;
    }
    if (!currencyOptions.length) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createCurrencyFirst"), tone: "error" });
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Exchange) {
    setEditing(row);
    setDialogOpen(true);
  }

  function validationMessage(field: ReturnType<typeof missingExchangeField>) {
    if (field === "store") return t("settings.storeRequired");
    if (field === "currency") return t("settings.createCurrencyFirst");
    if (field === "rate") return t("settings.exchangeRateRequired");
    return "";
  }

  async function save(formData: FormData) {
    const currencyUuid = String(formData.get("currency_uuid_fk") ?? "").trim();
    const price = String(formData.get("ex_price") ?? "").trim();
    const status = String(formData.get("ex_status") ?? "1");
    const missing = missingExchangeField({ currencyUuid, price, storeUuid });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: validationMessage(missing), tone: "error" });
      return;
    }

    try {
      await saveRow(buildExchangePayload({ currencyUuid, editing, price, status, storeUuid }));
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

  async function remove(row: Exchange) {
    const id = exchangeId(row);
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
      <Table className="min-w-[940px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{t("nav.currency")}</TableHead>
            <TableHead>{t("fields.ex_price")}</TableHead>
            <TableHead>{t("fields.ex_status")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = exchangeId(row);
            const selected = selectedRows.has(id);
            const name = currencyName(row, currencyById);
            return (
              <TableRow key={id || index} className="h-14" data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell className="max-w-[28rem]">
                  <CurrencyIdentity currencyById={currencyById} row={row} />
                </TableCell>
                <TableCell>
                  <RateBadge rate={exchangeRate(row)} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={exchangeStatus(row)} />
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
        const id = exchangeId(row);
        const selected = selectedRows.has(id);
        const icon = currencyIcon(row, currencyById);
        const currencyUuid = currencyId(row);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            badges={
              <>
                <RateBadge rate={exchangeRate(row)} />
                <StatusBadge status={exchangeStatus(row)} />
              </>
            }
            checked={selected}
            leading={<CurrencyFlag code={icon} label={currencyName(row, currencyById)} />}
            selectLabel={t("common.selectRow", { name: currencyName(row, currencyById) })}
            selected={selected}
            subtitle={
              <span className="block truncate" translate="no">
                {[icon !== "-" ? icon : "", currencyUuid].filter(Boolean).join(" / ")}
              </span>
            }
            title={currencyName(row, currencyById)}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.ex_price")} value={<RateBadge rate={exchangeRate(row)} />} />
              <SettingsMobileMeta label={t("fields.ex_status")} value={<StatusBadge status={exchangeStatus(row)} />} />
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
            <p className="text-sm font-black">{t("settings.exchangeList")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingList")}
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
        addLabel={`${t("actions.add")} ${t("nav.exchange_rate")}`}
        cardTitle={t("settings.exchangeList")}
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
      <ExchangeFormDialog
        currencies={currencyOptions}
        description={description}
        editing={editing}
        open={dialogOpen}
        saving={saving}
        storeUuid={storeUuid}
        title={title}
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

function ExchangeFormDialog({
  currencies,
  description,
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving,
  storeUuid,
  title
}: {
  currencies: Currency[];
  description: string;
  editing: Exchange | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  storeUuid: string;
  title: string;
}) {
  const { t } = useTranslation();
  const [currencyUuid, setCurrencyUuid] = useState("");
  const [exPrice, setExPrice] = useState("");
  const [exStatus, setExStatus] = useState("1");
  const formKey = exchangeId(editing) || "new-exchange";

  const currencyOptions = useMemo(() => {
    const editingCurrencyId = currencyId(editing);
    if (!editingCurrencyId || currencies.some((currency) => currencyId(currency) === editingCurrencyId)) return currencies;
    return [
      {
        currency_uuid: editingCurrencyId,
        currency_name: exchangeValue(editing, "currency_name", "-"),
        currency_icon: exchangeValue(editing, "currency_icon")
      },
      ...currencies
    ];
  }, [currencies, editing]);

  useEffect(() => {
    setCurrencyUuid(currencyId(editing));
    setExPrice(exchangeValue(editing, "ex_price"));
    setExStatus(exchangeStatus(editing));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-2xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("fields.currency_uuid_fk")}</FieldLegend>
                  <FieldDescription>{t("settings.selectCurrency")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="currency_uuid_fk">{t("fields.currency_uuid_fk")}</FieldLabel>
                  <input name="currency_uuid_fk" type="hidden" value={currencyUuid} />
                  <Select required value={currencyUuid} onValueChange={setCurrencyUuid}>
                    <SelectTrigger id="currency_uuid_fk" className="w-full" disabled={saving}>
                      <SelectValue placeholder={t("settings.selectCurrency")} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {currencyOptions.map((currency) => {
                          const uuid = currencyId(currency);
                          return (
                            <SelectItem key={uuid} value={uuid}>
                              <CurrencyOptionContent currency={currency} />
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.modules.exchange.title")}</FieldLegend>
                  <FieldDescription>{t("settings.exchangeFormHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="ex_price">{t("fields.ex_price")}</FieldLabel>
                    <Input
                      id="ex_price"
                      name="ex_price"
                      autoComplete="off"
                      disabled={saving}
                      inputMode="decimal"
                      min={0}
                      required
                      step="any"
                      type="number"
                      value={exPrice}
                      onChange={(event) => setExPrice(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ex_status">{t("fields.ex_status")}</FieldLabel>
                    <input name="ex_status" type="hidden" value={exStatus} />
                    <Select required value={exStatus} onValueChange={setExStatus}>
                      <SelectTrigger id="ex_status" className="w-full" disabled={saving}>
                        <SelectValue placeholder={t("fields.ex_status")} />
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
            </FieldGroup>
          </SettingsDialogBody>
          <input name="store_uuid_fk" type="hidden" value={storeUuid} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !storeUuid || !currencyUuid || !exPrice.trim()} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
