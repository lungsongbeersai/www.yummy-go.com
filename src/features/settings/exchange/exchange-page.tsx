"use client";

import { isActiveStatus, StatusBadge } from "@/components/common/status-badge";
import { useEffect, useMemo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
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
  SettingsToolbar,
  SettingsEmptyRecords,} from "@/features/settings/shared/settings-shell";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Currency } from "@/services/currency";
import type { Exchange, FetchExchangesParams, SaveExchangeInput } from "@/services/exchange";
import type { SortOrder } from "@/services/shared/types";
import { useExchangeStore } from "@/stores/exchange-store";
import { useReferenceStore } from "@/stores/reference-store";
import {
  buildExchangePayload,
  currencyIcon,
  currencyId,
  currencyName,
  currencyOptionLabel,
  exchangeId,
  exchangeRate,
  exchangeStatus,
  exchangeValue,
  missingExchangeField
} from "./exchange-utils";

const ORDER_OPTIONS: Array<{ labelKey: "asc" | "desc"; value: SortOrder }> = [
  { labelKey: "asc", value: "ASC" },
  { labelKey: "desc", value: "DESC" }
];

function RateBadge({ rate }: { rate: string }) {
  return (
    <Badge className="border-primary/20 bg-primary/10 text-primary" translate="no">
      {rate}
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
  const meta = icon !== "-" ? icon : "";

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
  const title = t("settings.modules.exchange.title");
  const description = t("settings.modules.exchange.description");
  const loadCurrencyOptions = useReferenceStore((state) => state.loadCurrencies);
  const [currencyOptions, setCurrencyOptions] = useState<Currency[]>([]);
  const {
    allSelected,
    applyFilters,
    backgroundLoading,
    canGoBack,
    canGoNext,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    limit,
    missingRequiredScope,
    onDialogOpenChange,
    openEdit,
    orderBy,
    page,
    pageEnd,
    pageStart,
    remove,
    requiredScopeDescription,
    rows,
    save,
    saving,
    search,
    selectedRows,
    setDeleteTarget,
    setDialogOpen,
    setEditing,
    setOrderBy,
    setPage,
    setSearch,
    showToast,
    storeUuid,
    toggleAll,
    toggleSelected,
    total,
    totalPages
  } = useSettingsCrudController<Exchange, SaveExchangeInput, FetchExchangesParams>({
    buildInput: ({ editing: editingRow, formData, storeUuid: scopedStoreUuid }) => {
      const currencyUuid = String(formData.get("currency_uuid_fk") ?? "").trim();
      const price = String(formData.get("ex_price") ?? "").trim();
      const status = String(formData.get("ex_status") ?? "1");
      return buildExchangePayload({ currencyUuid, editing: editingRow, price, status, storeUuid: scopedStoreUuid });
    },
    idKey: "ex_uuid",
    initialPagination,
    requiredScopeKey: "store_uuid_fk",
    requiredScopeMessage: t("settings.storeRequired"),
    scope: (storeUuid) => ({ store_uuid_fk: storeUuid }),
    store: useExchangeStore,
    title,
    validateInput: ({ formData, storeUuid: scopedStoreUuid }) => {
      const currencyUuid = String(formData.get("currency_uuid_fk") ?? "").trim();
      const price = String(formData.get("ex_price") ?? "").trim();
      const missing = missingExchangeField({ currencyUuid, price, storeUuid: scopedStoreUuid });
      if (missing === "store") return t("settings.storeRequired");
      if (missing === "currency") return t("settings.createCurrencyFirst");
      if (missing === "rate") return t("settings.exchangeRateRequired");
      return null;
    }
  });

  const currencyById = useMemo(() => {
    const map = new Map<string, Currency>();
    currencyOptions.forEach((currency) => {
      const id = currencyId(currency);
      if (id) map.set(id, currency);
    });
    return map;
  }, [currencyOptions]);

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

  // ต้องมีทั้งร้านและสกุลเงินก่อนจึงเปิดฟอร์มได้ — เช็คเพิ่มจากที่ controller เช็คสโคปร้านให้แล้ว
  function openCreate() {
    if (missingRequiredScope) {
      showToast({ title: t("settings.saveFailed"), description: requiredScopeDescription, tone: "error" });
      return;
    }
    if (!currencyOptions.length) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createCurrencyFirst"), tone: "error" });
      return;
    }
    setEditing(null);
    setDialogOpen(true);
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
                  <StatusBadge active={isActiveStatus(exchangeStatus(row))} />
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
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            badges={
              <>
                <RateBadge rate={exchangeRate(row)} />
                <StatusBadge active={isActiveStatus(exchangeStatus(row))} />
              </>
            }
            checked={selected}
            leading={<CurrencyFlag code={icon} label={currencyName(row, currencyById)} />}
            selectLabel={t("common.selectRow", { name: currencyName(row, currencyById) })}
            selected={selected}
            subtitle={
              <span className="block truncate" translate="no">
                {icon !== "-" ? icon : "-"}
              </span>
            }
            title={currencyName(row, currencyById)}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.ex_price")} value={<RateBadge rate={exchangeRate(row)} />} />
              <SettingsMobileMeta label={t("fields.ex_status")} value={<StatusBadge active={isActiveStatus(exchangeStatus(row))} />} />
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
        <SettingsEmptyRecords icon={<Coins aria-hidden />} title={title.toLowerCase()} />
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
      <ExchangeFormDialog
        currencies={currencyOptions}
        description={description}
        editing={editing}
        open={dialogOpen}
        saving={saving}
        storeUuid={storeUuid}
        title={title}
        onOpenChange={onDialogOpenChange}
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

  useResetOnChange(`${formKey}:${open}`, () => {
    setCurrencyUuid(currencyId(editing));
    setExPrice(exchangeValue(editing, "ex_price"));
    setExStatus(exchangeStatus(editing));
  });

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
                    <FormattedNumberInput
                      decimal
                      id="ex_price"
                      name="ex_price"
                      autoComplete="off"
                      disabled={saving}
                      min={0}
                      required
                      step="any"
                      value={exPrice}
                      onValueChange={setExPrice}
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
