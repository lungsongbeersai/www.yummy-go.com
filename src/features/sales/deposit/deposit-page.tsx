"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, PackagePlus, RefreshCcw, Wine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { dateTime } from "@/lib/format";
import type { Customer } from "@/services/customer";
import type { DepositListStatusFilter, DepositRow } from "@/services/deposit";
import type { Product, ProductDetail } from "@/services/product";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid } from "@/stores/auth-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useDepositStore } from "@/stores/deposit-store";
import { useProductStore } from "@/stores/product-store";
import { useToastStore } from "@/stores/toast-store";
import {
  depositBadgeVariant,
  toDepositQtyInput,
  validateDepositCreate,
  validateDepositWithdraw
} from "./deposit-utils";

const SEARCH_DEBOUNCE_MS = 300;
const PICKER_LIMIT = 20;

const STATUS_FILTERS: DepositListStatusFilter[] = ["active", "expired", "withdrawn", "cancelled", "all"];

function customerUuidOf(customer: Customer) {
  return String(customer.customer_uuid ?? "").trim();
}

function customerLabel(customer: Customer) {
  return customer.customer_phone
    ? `${customer.customer_name || "-"} · ${customer.customer_phone}`
    : customer.customer_name || "-";
}

function productDetailUuid(detail: ProductDetail) {
  return String(
    detail.pro_detail_uuid ?? detail.detail_uuid ?? detail.prod_detail_uuid ?? detail.product_detail_uuid ?? ""
  ).trim();
}

interface ProductDetailOption {
  key: string;
  productName: string;
  sizeName: string;
}

function productDetailOptions(products: Product[], isEng: boolean): ProductDetailOption[] {
  const options: ProductDetailOption[] = [];
  for (const product of products) {
    const productName = isEng
      ? product.prod_name_eng || product.prod_name_la || "-"
      : product.prod_name_la || product.prod_name_eng || "-";
    for (const detail of product.details ?? []) {
      const key = productDetailUuid(detail);
      if (!key) continue;
      const sizeName = isEng
        ? detail.size_name_eng || detail.size_name_la || detail.size_name || ""
        : detail.size_name_la || detail.size_name_eng || detail.size_name || "";
      options.push({ key, productName, sizeName });
    }
  }
  return options;
}

function productDetailOptionLabel(option: ProductDetailOption) {
  return option.sizeName ? `${option.productName} (${option.sizeName})` : option.productName;
}

function dateOnly(value?: string | null) {
  return value ? String(value).slice(0, 10) : "-";
}

function validationKey(prefix: string, error: string | null) {
  return error ? `deposit.validation.${prefix}${error.charAt(0).toUpperCase()}${error.slice(1)}` : "";
}

export function DepositPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const isEng = language === "en";
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);

  const rows = useDepositStore((state) => state.rows);
  const detail = useDepositStore((state) => state.detail);
  const detailWithdrawals = useDepositStore((state) => state.detailWithdrawals);
  const detailLoading = useDepositStore((state) => state.detailLoading);
  const loading = useDepositStore((state) => state.loading);
  const saving = useDepositStore((state) => state.saving);
  const withdrawing = useDepositStore((state) => state.withdrawing);
  const error = useDepositStore((state) => state.error);
  const loadList = useDepositStore((state) => state.loadList);
  const loadDetail = useDepositStore((state) => state.loadDetail);
  const createDepositAction = useDepositStore((state) => state.create);
  const withdrawAction = useDepositStore((state) => state.withdraw);
  const clearDetail = useDepositStore((state) => state.clearDetail);
  const showToast = useToastStore((state) => state.show);

  const customerRows = useCustomerStore((state) => state.rows);
  const customerLoading = useCustomerStore((state) => state.loading);
  const loadCustomers = useCustomerStore((state) => state.load);

  const productRows = useProductStore((state) => state.rows);
  const productLoading = useProductStore((state) => state.loading);
  const loadProducts = useProductStore((state) => state.load);

  const branchUuid = user?.branch_uuid ?? "";
  const [statusFilter, setStatusFilter] = useState<DepositListStatusFilter>("active");
  const [search, setSearch] = useState("");

  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerUuid, setCustomerUuid] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [proDetailUuid, setProDetailUuid] = useState("");
  const [selectedProductOption, setSelectedProductOption] = useState<ProductDetailOption | null>(null);

  const [depositQtyInput, setDepositQtyInput] = useState("1");
  const [expireDate, setExpireDate] = useState("");
  const [note, setNote] = useState("");
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);

  const [withdrawQtyInput, setWithdrawQtyInput] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);

  const depositQty = toDepositQtyInput(depositQtyInput);
  const withdrawQty = toDepositQtyInput(withdrawQtyInput);

  const createValidationError = validateDepositCreate({
    customerUuid,
    proDetailUuid,
    depositQty,
    expireDate
  });
  const withdrawValidationError = validateDepositWithdraw({ qtyWithdrawn: withdrawQty, deposit: detail });

  const productOptions = useMemo(() => productDetailOptions(productRows, isEng), [productRows, isEng]);

  const resetCreateForm = useCallback(() => {
    setCustomerUuid("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setProDetailUuid("");
    setSelectedProductOption(null);
    setProductSearch("");
    setDepositQtyInput("1");
    setExpireDate("");
    setNote("");
  }, []);

  const loadRows = useCallback(
    (nextBranchUuid: string, nextStatus: DepositListStatusFilter, nextSearch: string) => {
      if (!nextBranchUuid) return;
      void loadList({ branchUuid: nextBranchUuid, status: nextStatus, search: nextSearch, lang: language }).catch(
        (loadError: unknown) => {
          showToast({
            title: t("deposit.loadFailed"),
            description: loadError instanceof Error ? loadError.message : "",
            tone: "error"
          });
        }
      );
    },
    [language, loadList, showToast, t]
  );

  useEffect(() => {
    if (!branchUuid) return;
    const query = search.trim();
    const timer = window.setTimeout(
      () => loadRows(branchUuid, statusFilter, search),
      query ? SEARCH_DEBOUNCE_MS : 0
    );
    return () => window.clearTimeout(timer);
  }, [branchUuid, statusFilter, search, loadRows]);

  useEffect(() => {
    if (!storeUuid || !customerOpen) return;
    const query = customerSearch.trim();
    const timer = window.setTimeout(() => {
      void loadCustomers({ store_uuid_fk: storeUuid, search: query, limit: PICKER_LIMIT, lang: language });
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [customerOpen, customerSearch, language, loadCustomers, storeUuid]);

  useEffect(() => {
    if (!branchUuid || !productOpen) return;
    const query = productSearch.trim();
    const timer = window.setTimeout(() => {
      void loadProducts({ branch_uuid_fk: branchUuid, search: query, limit: PICKER_LIMIT, lang: language });
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [branchUuid, language, loadProducts, productOpen, productSearch]);

  function selectRow(row: DepositRow) {
    setWithdrawQtyInput("");
    setWithdrawNote("");
    void loadDetail(row.deposit_uuid, language).catch((loadError: unknown) => {
      showToast({
        title: t("deposit.detailLoadFailed"),
        description: loadError instanceof Error ? loadError.message : "",
        tone: "error"
      });
    });
  }

  function selectCustomer(customer: Customer) {
    setCustomerUuid(customerUuidOf(customer));
    setSelectedCustomer(customer);
    setCustomerOpen(false);
  }

  function selectProductOption(option: ProductDetailOption) {
    setProDetailUuid(option.key);
    setSelectedProductOption(option);
    setProductOpen(false);
  }

  function requestCreateConfirmation() {
    if (createValidationError) {
      showToast({ title: t(validationKey("create", createValidationError)), tone: "error" });
      return;
    }
    setConfirmCreateOpen(true);
  }

  async function submitCreate() {
    if (createValidationError || saving) return;

    try {
      await createDepositAction({
        request_uuid: crypto.randomUUID(),
        branch_uuid: branchUuid,
        customer_uuid: customerUuid,
        pro_detail_uuid: proDetailUuid,
        deposit_qty: depositQty,
        expire_date: expireDate || undefined,
        note: note.trim(),
        lang: language
      });
      setConfirmCreateOpen(false);
      resetCreateForm();
      showToast({ title: t("deposit.createSuccess"), tone: "success" });
      loadRows(branchUuid, statusFilter, search);
    } catch (createError) {
      showToast({
        title: t("deposit.createFailed"),
        description: createError instanceof Error ? createError.message : "",
        tone: "error"
      });
    }
  }

  function requestWithdrawConfirmation() {
    if (withdrawValidationError) {
      showToast({ title: t(validationKey("withdraw", withdrawValidationError)), tone: "error" });
      return;
    }
    setConfirmWithdrawOpen(true);
  }

  async function submitWithdraw() {
    if (withdrawValidationError || withdrawing || !detail) return;

    try {
      await withdrawAction({
        request_uuid: crypto.randomUUID(),
        deposit_uuid: detail.deposit_uuid,
        qty_withdrawn: withdrawQty,
        note: withdrawNote.trim(),
        lang: language
      });
      setConfirmWithdrawOpen(false);
      setWithdrawQtyInput("");
      setWithdrawNote("");
      showToast({ title: t("deposit.withdrawSuccess"), tone: "success" });
    } catch (withdrawError) {
      showToast({
        title: t("deposit.withdrawFailed"),
        description: withdrawError instanceof Error ? withdrawError.message : "",
        tone: "error"
      });
    }
  }

  function refresh() {
    loadRows(branchUuid, statusFilter, search);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <header className="shrink-0 border-b border-border bg-card px-3 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <Wine className="size-4" />
              {t("nav.sales")}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("deposit.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("deposit.subtitle")}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(11rem,1fr)_minmax(13rem,1fr)_minmax(14rem,1fr)_auto]">
            <Field>
              <FieldLabel>{t("deposit.statusFilter")}</FieldLabel>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DepositListStatusFilter)}>
                <SelectTrigger aria-label={t("deposit.statusFilter")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((status) => (
                    <SelectItem key={status} value={status}>{t(`deposit.statusOptions.${status}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="deposit-search">{t("deposit.search")}</FieldLabel>
              <Input
                id="deposit-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("deposit.searchPlaceholder")}
              />
            </Field>
            <div />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="self-end"
              aria-label={t("actions.refresh")}
              disabled={loading}
              onClick={refresh}
            >
              <RefreshCcw className={loading ? "animate-spin" : undefined} />
            </Button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="shrink-0 px-3 pt-3">
          <Alert variant="destructive">
            <AlertTitle>{t("deposit.loadFailed")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-auto xl:grid xl:grid-cols-[minmax(0,1fr)_23rem] xl:overflow-hidden">
        <section className="border-r border-border p-3 xl:min-h-0 xl:overflow-auto">
          {loading ? (
            <DepositTableSkeleton />
          ) : rows.length ? (
            <DepositTable rows={rows} selectedUuid={detail?.deposit_uuid ?? ""} onSelect={selectRow} t={t} />
          ) : (
            <EmptyState title={t("deposit.noDeposits")} description={t("deposit.noDepositsHelp")} />
          )}

          {detail ? (
            <DepositDetailPanel
              deposit={detail}
              withdrawals={detailWithdrawals}
              loading={detailLoading}
              withdrawQtyInput={withdrawQtyInput}
              withdrawNote={withdrawNote}
              withdrawing={withdrawing}
              validationError={withdrawValidationError}
              onWithdrawQtyChange={setWithdrawQtyInput}
              onWithdrawNoteChange={setWithdrawNote}
              onWithdraw={requestWithdrawConfirmation}
              onClose={clearDetail}
              t={t}
            />
          ) : null}
        </section>

        <aside className="bg-card p-3 xl:min-h-0 xl:overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PackagePlus className="size-5 text-primary" />
                {t("deposit.createTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel>{t("deposit.customer")}</FieldLabel>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {selectedCustomer ? customerLabel(selectedCustomer) : t("deposit.selectCustomer")}
                      </span>
                      {customerLoading ? <Spinner /> : <ChevronsUpDown className="opacity-50" />}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={t("deposit.searchCustomer")}
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {customerLoading ? t("common.loading") : t("deposit.noCustomerResults")}
                        </CommandEmpty>
                        <CommandGroup>
                          {customerRows.map((customer) => {
                            const uuid = customerUuidOf(customer);
                            return (
                              <CommandItem key={uuid} value={uuid} onSelect={() => selectCustomer(customer)}>
                                {customerLabel(customer)}
                                <Check className={uuid === customerUuid ? "ml-auto opacity-100" : "ml-auto opacity-0"} />
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Field>

              <Field>
                <FieldLabel>{t("deposit.product")}</FieldLabel>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={productOpen}
                      className="w-full justify-between font-normal"
                      disabled={!branchUuid}
                    >
                      <span className="truncate">
                        {selectedProductOption
                          ? productDetailOptionLabel(selectedProductOption)
                          : t("deposit.selectProduct")}
                      </span>
                      {productLoading ? <Spinner /> : <ChevronsUpDown className="opacity-50" />}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={t("deposit.searchProduct")}
                        value={productSearch}
                        onValueChange={setProductSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {productLoading ? t("common.loading") : t("deposit.noProductResults")}
                        </CommandEmpty>
                        <CommandGroup>
                          {productOptions.map((option) => (
                            <CommandItem
                              key={option.key}
                              value={option.key}
                              onSelect={() => selectProductOption(option)}
                            >
                              {productDetailOptionLabel(option)}
                              <Check
                                className={option.key === proDetailUuid ? "ml-auto opacity-100" : "ml-auto opacity-0"}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Field>

              <Field>
                <FieldLabel htmlFor="deposit-qty">{t("deposit.qty")}</FieldLabel>
                <Input
                  id="deposit-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={depositQtyInput}
                  onChange={(event) => setDepositQtyInput(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="deposit-expire-date">{t("deposit.expireDate")}</FieldLabel>
                <Input
                  id="deposit-expire-date"
                  type="date"
                  value={expireDate}
                  onChange={(event) => setExpireDate(event.target.value)}
                />
                <FieldDescription>{t("deposit.expireDateHelp")}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="deposit-note">{t("deposit.note")}</FieldLabel>
                <Textarea
                  id="deposit-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("deposit.notePlaceholder")}
                />
              </Field>

              {createValidationError ? (
                <p className="text-sm font-medium text-destructive">{t(validationKey("create", createValidationError))}</p>
              ) : null}

              <Button className="w-full" size="lg" disabled={saving || Boolean(createValidationError)} onClick={requestCreateConfirmation}>
                {saving ? t("deposit.saving") : t("deposit.createSubmit")}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </main>

      <AlertDialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deposit.createConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deposit.createConfirmDescription", {
                customer: selectedCustomer ? customerLabel(selectedCustomer) : "",
                product: selectedProductOption ? productDetailOptionLabel(selectedProductOption) : "",
                qty: depositQty
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t("actions.cancel")}</AlertDialogCancel>
            <Button disabled={saving} onClick={() => void submitCreate()}>
              {saving ? t("deposit.saving") : t("deposit.createSubmit")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmWithdrawOpen} onOpenChange={setConfirmWithdrawOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deposit.withdrawConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deposit.withdrawConfirmDescription", { qty: withdrawQty, unit: detail?.unit_name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawing}>{t("actions.cancel")}</AlertDialogCancel>
            <Button disabled={withdrawing} onClick={() => void submitWithdraw()}>
              {withdrawing ? t("deposit.saving") : t("deposit.withdrawSubmit")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DepositTableProps {
  rows: DepositRow[];
  selectedUuid: string;
  onSelect: (row: DepositRow) => void;
  t: (key: string) => string;
}

function DepositTable({ rows, selectedUuid, onSelect, t }: DepositTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("deposit.depositNo")}</TableHead>
              <TableHead>{t("deposit.customer")}</TableHead>
              <TableHead>{t("deposit.product")}</TableHead>
              <TableHead className="text-right">{t("deposit.deposited")}</TableHead>
              <TableHead className="text-right">{t("deposit.remaining")}</TableHead>
              <TableHead>{t("deposit.expireDate")}</TableHead>
              <TableHead>{t("deposit.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.deposit_uuid}
                data-state={row.deposit_uuid === selectedUuid ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => onSelect(row)}
              >
                <TableCell className="font-bold">{row.deposit_no}</TableCell>
                <TableCell>
                  <div className="font-medium">{row.customer_name || "-"}</div>
                  <div className="text-xs text-muted-foreground">{row.customer_phone || "-"}</div>
                </TableCell>
                <TableCell>{row.product_name}</TableCell>
                <TableCell className="text-right">
                  {row.deposit_qty} {row.unit_name}
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {row.remaining_qty} {row.unit_name}
                </TableCell>
                <TableCell>{dateOnly(row.expire_date)}</TableCell>
                <TableCell>
                  <Badge variant={depositBadgeVariant(row)}>{row.status_text}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface DepositDetailPanelProps {
  deposit: DepositRow;
  withdrawals: { withdrawal_uuid: string; qty_withdrawn: number; withdrawn_at: string; note: string }[];
  loading: boolean;
  withdrawQtyInput: string;
  withdrawNote: string;
  withdrawing: boolean;
  validationError: string | null;
  onWithdrawQtyChange: (value: string) => void;
  onWithdrawNoteChange: (value: string) => void;
  onWithdraw: () => void;
  onClose: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function DepositDetailPanel(props: DepositDetailPanelProps) {
  const { deposit } = props;

  if (props.loading) return <DepositTableSkeleton />;

  return (
    <Card className="mt-3">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{props.t("deposit.detailTitle")} · {deposit.deposit_no}</CardTitle>
          <Badge variant={depositBadgeVariant(deposit)}>{deposit.status_text}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid gap-2 rounded-md border bg-muted/25 p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <DetailValue label={props.t("deposit.customer")} value={deposit.customer_name || "-"} />
          <DetailValue label={props.t("deposit.phone")} value={deposit.customer_phone || "-"} />
          <DetailValue label={props.t("deposit.product")} value={deposit.product_name} />
          <DetailValue label={props.t("deposit.expireDate")} value={dateOnly(deposit.expire_date)} />
          <DetailValue label={props.t("deposit.deposited")} value={`${deposit.deposit_qty} ${deposit.unit_name}`} />
          <DetailValue label={props.t("deposit.remaining")} value={`${deposit.remaining_qty} ${deposit.unit_name}`} />
          {deposit.note ? <DetailValue label={props.t("deposit.note")} value={deposit.note} /> : null}
        </div>

        <div className="mb-3 overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{props.t("deposit.withdrawnAt")}</TableHead>
                <TableHead className="text-right">{props.t("deposit.withdrawQty")}</TableHead>
                <TableHead>{props.t("deposit.note")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.withdrawals.length ? (
                props.withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.withdrawal_uuid}>
                    <TableCell>{dateTime(withdrawal.withdrawn_at)}</TableCell>
                    <TableCell className="text-right">{withdrawal.qty_withdrawn}</TableCell>
                    <TableCell className="text-muted-foreground">{withdrawal.note || "-"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {props.t("deposit.noWithdrawals")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {deposit.status === "ACTIVE" && !deposit.is_expired ? (
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <Field>
              <FieldLabel htmlFor="withdraw-qty">{props.t("deposit.withdrawQty")}</FieldLabel>
              <Input
                id="withdraw-qty"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={props.withdrawQtyInput}
                onChange={(event) => props.onWithdrawQtyChange(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="withdraw-note">{props.t("deposit.note")}</FieldLabel>
              <Input
                id="withdraw-note"
                value={props.withdrawNote}
                onChange={(event) => props.onWithdrawNoteChange(event.target.value)}
                placeholder={props.t("deposit.withdrawNotePlaceholder")}
              />
            </Field>
            <Button disabled={props.withdrawing} onClick={props.onWithdraw}>
              {props.withdrawing ? props.t("deposit.saving") : props.t("deposit.withdrawSubmit")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="truncate font-medium text-foreground" title={value}>{value}</p>
    </div>
  );
}

function DepositTableSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  );
}
