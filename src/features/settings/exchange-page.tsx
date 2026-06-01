"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyFlag } from "@/features/settings/currency-flag";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/settings-shell";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { Currency } from "@/services/currency";
import type { Exchange, FetchExchangesParams, SaveExchangeInput } from "@/services/exchange";
import type { ApiEntity, PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useExchangeStore } from "@/stores/exchange-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

function value(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

function exchangeId(row: Exchange | null | undefined) {
  return value(row, "ex_uuid");
}

function currencyId(row: Exchange | Currency | null | undefined) {
  return value(row, "currency_uuid_fk", value(row, "currency_uuid"));
}

function currencyName(row: Exchange | null | undefined, currencyById: Map<string, Currency>) {
  const related = currencyById.get(currencyId(row));
  return value(row, "currency_name", value(related, "currency_name", "-"));
}

function currencyMeta(row: Exchange | null | undefined, currencyById: Map<string, Currency>, key: "currency_icon") {
  const related = currencyById.get(currencyId(row));
  return value(row, key, value(related, key, "-"));
}

function currencyOptionLabel(currency: Currency) {
  const name = value(currency, "currency_name", "-");
  const icon = value(currency, "currency_icon");
  const meta = [icon].filter(Boolean).join(" / ");
  return meta ? `${name} (${meta})` : name;
}

function CurrencyOptionContent({ currency }: { currency: Currency }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <CurrencyFlag code={value(currency, "currency_icon")} label={value(currency, "currency_name")} small />
      <span className="truncate">{currencyOptionLabel(currency)}</span>
    </span>
  );
}

function statusLabel(status: string, activeLabel: string, inactiveLabel: string) {
  return Number(status || 1) === 1 ? activeLabel : inactiveLabel;
}

export function ExchangeSettingsPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const rows = useExchangeStore((state) => state.rows);
  const total = useExchangeStore((state) => state.total);
  const storeTotalPages = useExchangeStore((state) => state.totalPages);
  const search = useExchangeStore((state) => state.search);
  const loading = useExchangeStore((state) => state.loading);
  const saving = useExchangeStore((state) => state.saving);
  const setSearch = useExchangeStore((state) => state.setSearch);
  const loadRows = useExchangeStore((state) => state.load);
  const saveRow = useExchangeStore((state) => state.save);
  const removeRow = useExchangeStore((state) => state.remove);
  const loadCurrencyOptions = useReferenceStore((state) => state.loadCurrencies);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
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
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const ids = useMemo(() => rows.map(exchangeId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  async function load() {
    if (!storeUuid) {
      showToast({ title: t("settings.loadFailed", { title }), description: t("settings.storeRequired"), tone: "error" });
      return;
    }

    try {
      await loadRows(requestParams);
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

  async function save(formData: FormData) {
    if (!storeUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.storeRequired"), tone: "error" });
      return;
    }

    const input: SaveExchangeInput = {
      store_uuid_fk: storeUuid,
      currency_uuid_fk: formData.get("currency_uuid_fk") ?? "",
      ex_price: formData.get("ex_price") ?? "",
      ex_status: Number(formData.get("ex_status") ?? 1)
    };
    const id = exchangeId(editing);
    if (id) input.ex_uuid = id;

    try {
      await saveRow(input);
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams);
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
      await loadRows(requestParams);
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
      <Table className="min-w-[980px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{t("nav.currency")}</TableHead>
            <TableHead>{t("fields.ex_price")}</TableHead>
            <TableHead>{t("fields.ex_status")}</TableHead>
            <TableHead>{t("fields.currency_icon")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = exchangeId(row);
            const selected = selectedRows.has(id);
            return (
              <TableRow key={id || index} data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name: currencyName(row, currencyById) })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <CurrencyFlag code={currencyMeta(row, currencyById, "currency_icon")} label={currencyName(row, currencyById)} />
                    <div className="min-w-0">
                      <p className="truncate font-black">{currencyName(row, currencyById)}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-primary/10 text-primary">{value(row, "ex_price", "-")}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={Number(value(row, "ex_status", "1")) === 1 ? "border-primary/25 bg-primary/10 text-primary" : undefined}>
                    {statusLabel(value(row, "ex_status", "1"), t("common.active"), t("common.inactive"))}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{currencyMeta(row, currencyById, "currency_icon")}</TableCell>
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
        const status = value(row, "ex_status", "1");
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            badges={
              <>
                <Badge className="bg-primary/10 text-primary">{value(row, "ex_price", "-")}</Badge>
                <Badge className={Number(status) === 1 ? "border-primary/25 bg-primary/10 text-primary" : undefined}>
                  {statusLabel(status, t("common.active"), t("common.inactive"))}
                </Badge>
              </>
            }
            checked={selected}
            leading={<CurrencyFlag code={currencyMeta(row, currencyById, "currency_icon")} label={currencyName(row, currencyById)} />}
            selectLabel={t("common.selectRow", { name: currencyName(row, currencyById) })}
            selected={selected}
            title={currencyName(row, currencyById)}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.currency_icon")} value={currencyMeta(row, currencyById, "currency_icon")} />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

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
        loading={loading}
        loadingLabel={t("settings.loading", { title })}
        mobileList={mobileList}
        summary={`${t("common.showingRange", { start: pageStart, end: pageEnd, total })} - ${t("common.page", { current: page, total: totalPages })}`}
        table={table}
        title={title}
        toolbar={
          <SettingsToolbar
            state={{
              search,
              limit,
              orderBy,
              limitOptions: PAGE_LIMIT_OPTIONS,
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
        }
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
  const [exStatus, setExStatus] = useState("1");

  const currencyOptions = useMemo(() => {
    const editingCurrencyId = currencyId(editing);
    if (!editingCurrencyId || currencies.some((currency) => currencyId(currency) === editingCurrencyId)) return currencies;
    return [
      {
        currency_uuid: editingCurrencyId,
        currency_name: value(editing, "currency_name", "-"),
        currency_icon: value(editing, "currency_icon")
      },
      ...currencies
    ];
  }, [currencies, editing]);

  useEffect(() => {
    setCurrencyUuid(currencyId(editing));
    setExStatus(value(editing, "ex_status", "1"));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent>
        <SettingsDialogForm action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{t("settings.exchangeFormHint")}</FieldLabel>
                <FieldDescription>{t("settings.selectCurrency")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="currency_uuid_fk">{t("fields.currency_uuid_fk")}</FieldLabel>
                <input name="currency_uuid_fk" type="hidden" value={currencyUuid} />
                <Select required value={currencyUuid} onValueChange={setCurrencyUuid}>
                  <SelectTrigger id="currency_uuid_fk" className="w-full">
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ex_price">{t("fields.ex_price")}</FieldLabel>
                  <Input id="ex_price" min={0} name="ex_price" step="any" type="number" defaultValue={value(editing, "ex_price")} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ex_status">{t("fields.ex_status")}</FieldLabel>
                  <input name="ex_status" type="hidden" value={exStatus} />
                  <Select required value={exStatus} onValueChange={setExStatus}>
                    <SelectTrigger id="ex_status" className="w-full">
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
              </div>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="store_uuid_fk" type="hidden" value={storeUuid} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !storeUuid || !currencyUuid} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
