"use client";

import { isActiveStatus, StatusBadge } from "@/components/common/status-badge";
import { useEffect, useMemo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyFlag } from "@/features/settings/shared/currency-flag";
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
import { SettingsListPageLayout } from "@/features/settings/shared/settings-list-page-layout";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsEmptyRecords,
  SettingsRowActions
} from "@/features/settings/shared/settings-shell";
import { useSettingsCrudController } from "@/features/settings/shared/use-settings-crud-controller";
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

// The rate is a number to compare down the column: plain, right-aligned, tabular — not a badge.
function Rate({ rate }: { rate: string }) {
  return (
    <span className="font-medium tabular-nums" translate="no">
      {rate}
    </span>
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
        <p className="truncate font-medium">{name}</p>
        {meta ? (
          <p className="truncate text-muted-foreground" translate="no">
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

  const table = (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          <TableHead className="w-px">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => toggleAll(checked === true)} />
          </TableHead>
          {/* w-px: checkbox, number and actions shrink to their content. */}
          <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
          <TableHead className="min-w-56">{t("nav.currency")}</TableHead>
          <TableHead className="text-right">{t("fields.ex_price")}</TableHead>
          <TableHead>{t("fields.ex_status")}</TableHead>
          <TableHead className="w-px">
            <span className="sr-only">{t("common.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const id = exchangeId(row);
          const selected = selectedRows.has(id);
          const name = currencyName(row, currencyById);
          return (
            <TableRow key={id || index} data-state={selected ? "selected" : undefined}>
              <TableCell>
                <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onCheckedChange={(checked) => toggleSelected(id, checked === true)} />
              </TableCell>
              <TableCell className="text-center text-muted-foreground tabular-nums">{pageStart + index}</TableCell>
              <TableCell>
                <CurrencyIdentity currencyById={currencyById} row={row} />
              </TableCell>
              <TableCell className="text-right">
                <Rate rate={exchangeRate(row)} />
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
  );

  // Narrow pages: one Item per rate, two columns once there is room.
  const mobileList = (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">
      {rows.map((row, index) => {
        const id = exchangeId(row);
        const icon = currencyIcon(row, currencyById);
        const name = currencyName(row, currencyById);
        return (
          <Item key={id || index} variant="outline">
            <Checkbox aria-label={t("common.selectRow", { name })} checked={selectedRows.has(id)} onCheckedChange={(checked) => toggleSelected(id, checked === true)} />
            <ItemMedia>
              <CurrencyFlag code={icon} label={name} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{name}</ItemTitle>
              {icon !== "-" ? (
                <ItemDescription translate="no">{icon}</ItemDescription>
              ) : null}
            </ItemContent>
            <ItemActions>
              <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
            </ItemActions>
            <ItemFooter>
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{t("fields.ex_price")}:</span>
                <Rate rate={exchangeRate(row)} />
              </span>
              <StatusBadge active={isActiveStatus(exchangeStatus(row))} />
            </ItemFooter>
          </Item>
        );
      })}
    </ItemGroup>
  );

  return (
    <SettingsListPageLayout
      id="exchange"
      title={title}
      description={description}
      icon={Coins}
      addLabel={`${t("actions.add")} ${t("nav.exchange_rate")}`}
      onAdd={openCreate}
      loading={fullLoading}
      loadingLabel={t("settings.loading", { title })}
      search={search}
      searching={backgroundLoading}
      searchingLabel={t("settings.refreshingList")}
      onSearchChange={setSearch}
      onSearchApply={applyFilters}
      orderBy={orderBy}
      onOrderChange={(nextOrder) => {
        setOrderBy(nextOrder);
        setPage(1);
      }}
      orderOptions={ORDER_OPTIONS.map((option) => ({ label: t(`common.${option.labelKey}`), value: option.value }))}
      allSelected={allSelected}
      selectAllLabel={t("common.selectAll")}
      selectedCount={selectedRows.size}
      onToggleAll={toggleAll}
      hasRows={rows.length > 0}
      table={table}
      mobileList={mobileList}
      empty={<SettingsEmptyRecords icon={<Coins aria-hidden />} title={title.toLowerCase()} />}
      page={page}
      pageStart={pageStart}
      pageEnd={pageEnd}
      total={total}
      totalPages={totalPages}
      limit={limit}
      onLimitChange={changeLimit}
      onPageChange={setPage}
    >
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
    </SettingsListPageLayout>
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
