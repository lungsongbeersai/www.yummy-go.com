"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, RefreshCcw, Users } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/format";
import type {
  CreditBill,
  CreditCustomer,
  CreditPayMethod,
  CreditPayMode,
  CreditSingleBillDetail
} from "@/services/credit";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCreditStore } from "@/stores/credit-store";
import { useToastStore } from "@/stores/toast-store";
import {
  creditAllocationTotal,
  creditChange,
  selectedCreditBills,
  toCreditAmount,
  validateCreditPayment
} from "./credit-utils";

function dateLabel(value?: string | null) {
  return value ? String(value).slice(0, 10) : "-";
}

function paymentErrorKey(error: ReturnType<typeof validateCreditPayment>) {
  return error ? `credit.validation.${error}` : "";
}

export function CreditPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const bills = useCreditStore((state) => state.bills);
  const branches = useCreditStore((state) => state.branches);
  const customers = useCreditStore((state) => state.customers);
  const detail = useCreditStore((state) => state.detail);
  const detailLoading = useCreditStore((state) => state.detailLoading);
  const error = useCreditStore((state) => state.error);
  const loading = useCreditStore((state) => state.loading);
  const saving = useCreditStore((state) => state.saving);
  const summary = useCreditStore((state) => state.summary);
  const loadBills = useCreditStore((state) => state.loadBills);
  const loadBranches = useCreditStore((state) => state.loadBranches);
  const loadCustomers = useCreditStore((state) => state.loadCustomers);
  const loadDetail = useCreditStore((state) => state.loadDetail);
  const pay = useCreditStore((state) => state.pay);
  const clearBills = useCreditStore((state) => state.clearBills);
  const clearDetail = useCreditStore((state) => state.clearDetail);
  const showToast = useToastStore((state) => state.show);

  const [branchUuid, setBranchUuid] = useState("");
  const [customerUuid, setCustomerUuid] = useState("");
  const [mode, setMode] = useState<CreditPayMode>("single");
  const [selectedUuids, setSelectedUuids] = useState<string[]>([]);
  const [payMethod, setPayMethod] = useState<CreditPayMethod>(1);
  const [cashInput, setCashInput] = useState("0");
  const [transferInput, setTransferInput] = useState("0");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedBills = useMemo(
    () => selectedCreditBills(bills, selectedUuids),
    [bills, selectedUuids]
  );
  const allocationTotal = useMemo(
    () => creditAllocationTotal(bills, selectedUuids),
    [bills, selectedUuids]
  );
  const cashAmount = payMethod === 1 && cashInput === "" ? allocationTotal : toCreditAmount(cashInput);
  const transferAmount = payMethod === 2 && transferInput === "" ? allocationTotal : toCreditAmount(transferInput);
  const changeAmount = creditChange(payMethod, cashAmount, transferAmount, allocationTotal);
  const validationError = validateCreditPayment({
    customerUuid,
    mode,
    bills,
    selectedUuids,
    payMethod,
    cashAmount,
    transferAmount
  });
  const selectedCustomer = customers.find((customer) => customer.customer_uuid === customerUuid);
  const singleDetail = detail?.payment_type === "single" ? detail.bill : null;

  const resetPayment = useCallback(() => {
    setSelectedUuids([]);
    setCashInput("");
    setTransferInput("");
    setNote("");
    clearDetail();
  }, [clearDetail]);

  useEffect(() => {
    let active = true;
    void loadBranches(language)
      .then((response) => {
        if (!active) return;
        const available = response.branches ?? [];
        const preferred = available.find((branch) => branch.branch_uuid === user?.branch_uuid) ?? available[0];
        const preferredUuid = preferred?.branch_uuid ?? "";
        setBranchUuid(preferredUuid);
        setCustomerUuid("");
        resetPayment();
        if (preferredUuid) return loadCustomers(preferredUuid, language);
        return undefined;
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        showToast({
          title: t("credit.loadFailed"),
          description: loadError instanceof Error ? loadError.message : "",
          tone: "error"
        });
      });
    return () => {
      active = false;
    };
  }, [language, loadBranches, loadCustomers, resetPayment, showToast, t, user?.branch_uuid]);

  function changeBranch(nextBranchUuid: string) {
    setBranchUuid(nextBranchUuid);
    setCustomerUuid("");
    setMode("single");
    setPayMethod(1);
    resetPayment();
    void loadCustomers(nextBranchUuid, language).catch((loadError: unknown) => {
      showToast({
        title: t("credit.loadFailed"),
        description: loadError instanceof Error ? loadError.message : "",
        tone: "error"
      });
    });
  }

  function changeCustomer(nextCustomerUuid: string) {
    setCustomerUuid(nextCustomerUuid);
    resetPayment();
    if (!nextCustomerUuid) {
      clearBills();
      return;
    }
    void loadBills(branchUuid, nextCustomerUuid, language).catch((loadError: unknown) => {
      showToast({
        title: t("credit.loadFailed"),
        description: loadError instanceof Error ? loadError.message : "",
        tone: "error"
      });
    });
  }

  function changeMode(nextMode: string) {
    setMode(nextMode as CreditPayMode);
    resetPayment();
  }

  function selectBill(bill: CreditBill, checked: boolean) {
    if (mode === "single") {
      if (!checked) {
        resetPayment();
        return;
      }
      setSelectedUuids([bill.payment_uuid]);
      void loadDetail(branchUuid, customerUuid, [bill.payment_uuid], language).catch((loadError: unknown) => {
        showToast({
          title: t("credit.detailLoadFailed"),
          description: loadError instanceof Error ? loadError.message : "",
          tone: "error"
        });
      });
      return;
    }

    clearDetail();
    setSelectedUuids((current) => {
      if (checked) {
        return current.includes(bill.payment_uuid) ? current : [...current, bill.payment_uuid];
      }
      return current.filter((uuid) => uuid !== bill.payment_uuid);
    });
  }

  function selectAll(checked: boolean) {
    if (!checked) {
      resetPayment();
      return;
    }
    const uuids = bills.map((bill) => bill.payment_uuid);
    setSelectedUuids(uuids);
  }

  function requestConfirmation() {
    if (validationError) {
      showToast({ title: t(paymentErrorKey(validationError)), tone: "error" });
      return;
    }
    setConfirmOpen(true);
  }

  async function submitPayment() {
    if (validationError || saving) return;

    try {
      const response = await pay({
        request_uuid: crypto.randomUUID(),
        branch_uuid: branchUuid,
        customer_uuid: customerUuid,
        payment_type: mode,
        payment_method: payMethod,
        cash_payment_amount: cashAmount,
        transfer_payment_amount: transferAmount,
        change_amount: changeAmount,
        note: note.trim(),
        lang: language,
        items: selectedBills.map((bill) => ({
          payment_uuid: bill.payment_uuid,
          pay_amount: toCreditAmount(bill.balance)
        }))
      });
      setConfirmOpen(false);
      resetPayment();
      showToast({
        title: t("credit.paySuccess"),
        description: response.receipt.receipt_no,
        tone: "success"
      });
    } catch (payError) {
      showToast({
        title: t("credit.payFailed"),
        description: payError instanceof Error ? payError.message : "",
        tone: "error"
      });
    }
  }

  async function refresh() {
    try {
      if (branchUuid && customerUuid) await loadBills(branchUuid, customerUuid, language);
      else if (branchUuid) await loadCustomers(branchUuid, language);
      else await loadBranches(language);
    } catch (loadError) {
      showToast({
        title: t("credit.loadFailed"),
        description: loadError instanceof Error ? loadError.message : "",
        tone: "error"
      });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <header className="shrink-0 border-b border-border bg-card px-3 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <CreditCard className="size-4" />
              {t("nav.sales")}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("credit.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("credit.subtitle")}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(14rem,1fr)_auto]">
            <Field>
              <FieldLabel>{t("credit.branch")}</FieldLabel>
              <Select value={branchUuid} onValueChange={changeBranch} disabled={loading || saving || !branches.length}>
                <SelectTrigger aria-label={t("credit.branch")}><SelectValue placeholder={t("credit.selectBranch")} /></SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.branch_uuid} value={branch.branch_uuid}>{branch.branch_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("credit.billType")}</FieldLabel>
              <Select value={mode} onValueChange={changeMode} disabled={saving || !branchUuid}>
                <SelectTrigger aria-label={t("credit.billType")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{t("credit.singleBill")}</SelectItem>
                  <SelectItem value="multiple">{t("credit.multipleBills")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("credit.customer")}</FieldLabel>
              <Select value={customerUuid} onValueChange={changeCustomer} disabled={loading || saving || !branchUuid}>
                <SelectTrigger aria-label={t("credit.customer")}><SelectValue placeholder={t("credit.selectCustomer")} /></SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.customer_uuid} value={customer.customer_uuid}>
                      {customer.customer_name}{customer.customer_phone ? ` · ${customer.customer_phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="self-end"
              aria-label={t("actions.refresh")}
              disabled={loading || saving}
              onClick={() => void refresh()}
            >
              <RefreshCcw className={loading ? "animate-spin" : undefined} />
            </Button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="shrink-0 px-3 pt-3">
          <Alert variant="destructive">
            <AlertTitle>{t("credit.loadFailed")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-auto xl:grid xl:grid-cols-[minmax(0,1fr)_23rem] xl:overflow-hidden">
        <section className="border-r border-border p-3 xl:min-h-0 xl:overflow-auto">
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <SummaryCard label={t("credit.billCount")} value={String(summary?.bill_count ?? 0)} />
            <SummaryCard label={t("credit.billTotal")} value={money(summary?.bill_total)} />
            <SummaryCard label={t("credit.outstanding")} value={money(summary?.balance)} emphasis />
          </div>

          {selectedCustomer ? (
            <Card className="mb-3 border-primary/25 bg-primary/5">
              <CardContent className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-6">
                <div className="flex min-w-0 items-center gap-2 sm:col-span-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="size-4" />
                  </div>
                  <DetailValue label={t("credit.customer")} value={selectedCustomer.customer_name || "-"} />
                </div>
                <DetailValue label={t("credit.memberCode")} value={selectedCustomer.member_code || "-"} />
                <DetailValue label={t("credit.phone")} value={selectedCustomer.customer_phone || "-"} />
                <DetailValue label={t("credit.billCount")} value={String(selectedCustomer.bill_count ?? 0)} />
                <DetailValue label={t("credit.outstanding")} value={money(selectedCustomer.balance)} />
                {selectedCustomer.customer_address ? (
                  <div className="sm:col-span-2 xl:col-span-6">
                    <DetailValue label={t("credit.address")} value={selectedCustomer.customer_address} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {!customerUuid ? (
            <EmptyState title={t("credit.selectCustomer")} description={t("credit.selectCustomerHelp")} />
          ) : loading ? (
            <CreditTableSkeleton />
          ) : bills.length ? (
            <CreditBillsTable
              bills={bills}
              mode={mode}
              selectedUuids={selectedUuids}
              disabled={saving}
              onSelect={selectBill}
              onSelectAll={selectAll}
              t={t}
            />
          ) : (
            <EmptyState title={t("credit.noBills")} description={t("credit.noBillsHelp")} />
          )}

          {mode === "single" && selectedUuids.length === 1 ? (
            <CreditBillDetail
              bill={singleDetail}
              loading={detailLoading}
              customer={detail?.customer ?? selectedCustomer}
              t={t}
            />
          ) : null}
        </section>

        <aside className="bg-card p-3 xl:min-h-0 xl:overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Banknote className="size-5 text-primary" />
                {t("credit.payment")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Alert>
                <AlertTitle>{t("credit.fullBillOnlyTitle")}</AlertTitle>
                <AlertDescription>{t("credit.fullBillOnlyDescription")}</AlertDescription>
              </Alert>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{t("credit.selectedBills")}</span><span>{selectedBills.length}</span>
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <span className="font-semibold">{t("credit.payThisTime")}</span>
                  <span className="text-xl font-black text-primary">{money(allocationTotal)}</span>
                </div>
              </div>

              <Field>
                <FieldLabel>{t("credit.payMethod")}</FieldLabel>
                <Select
                  value={String(payMethod)}
                  onValueChange={(value) => {
                    const nextMethod = Number(value) as CreditPayMethod;
                    setPayMethod(nextMethod);
                    if (nextMethod === 3) {
                      setCashInput("0");
                      setTransferInput("0");
                    } else {
                      setCashInput("");
                      setTransferInput("");
                    }
                  }}
                >
                  <SelectTrigger aria-label={t("credit.payMethod")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t("credit.cash")}</SelectItem>
                    <SelectItem value="2">{t("credit.transfer")}</SelectItem>
                    <SelectItem value="3">{t("credit.mixed")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {payMethod !== 2 ? (
                <Field>
                  <FieldLabel htmlFor="credit-cash-amount">{t("credit.cashReceived")}</FieldLabel>
                  <Input id="credit-cash-amount" type="number" min="0" inputMode="decimal" value={cashInput === "" ? String(allocationTotal) : cashInput} onChange={(event) => setCashInput(event.target.value)} />
                </Field>
              ) : null}
              {payMethod !== 1 ? (
                <Field>
                  <FieldLabel htmlFor="credit-transfer-amount">{t("credit.transferAmount")}</FieldLabel>
                  <Input
                    id="credit-transfer-amount"
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={transferInput === "" ? String(allocationTotal) : transferInput}
                    onChange={(event) => setTransferInput(event.target.value)}
                  />
                </Field>
              ) : null}

              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span>{t("credit.change")}</span><strong>{money(changeAmount)}</strong>
              </div>

              <Field>
                <FieldLabel htmlFor="credit-payment-note">{t("credit.note")}</FieldLabel>
                <Textarea id="credit-payment-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("credit.notePlaceholder")} />
              </Field>

              {validationError && selectedUuids.length ? (
                <p className="text-sm font-medium text-destructive">{t(paymentErrorKey(validationError))}</p>
              ) : null}

              <Button className="w-full" size="lg" disabled={saving || Boolean(validationError)} onClick={requestConfirmation}>
                {saving ? t("credit.saving") : t("credit.confirmPayment")}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("credit.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("credit.confirmDescription", { count: selectedBills.length, total: money(allocationTotal) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t("actions.cancel")}</AlertDialogCancel>
            <Button disabled={saving} onClick={() => void submitPayment()}>
              {saving ? t("credit.saving") : t("credit.confirmPayment")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className={emphasis ? "mt-1 text-lg font-black text-destructive" : "mt-1 text-lg font-bold"}>{value}</p>
      </CardContent>
    </Card>
  );
}

interface CreditBillsTableProps {
  bills: CreditBill[];
  mode: CreditPayMode;
  selectedUuids: string[];
  disabled: boolean;
  onSelect: (bill: CreditBill, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  t: (key: string) => string;
}

function CreditBillsTable(props: CreditBillsTableProps) {
  const allSelected = props.bills.length > 0 && props.selectedUuids.length === props.bills.length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                {props.mode === "multiple" ? (
                  <Checkbox disabled={props.disabled} checked={allSelected} onCheckedChange={(checked) => props.onSelectAll(checked as boolean)} aria-label={props.t("credit.selectAll")} />
                ) : null}
              </TableHead>
              <TableHead>{props.t("credit.invoice")}</TableHead>
              <TableHead>{props.t("credit.saleDate")}</TableHead>
              <TableHead>{props.t("credit.dueDate")}</TableHead>
              <TableHead className="text-right">{props.t("credit.qty")}</TableHead>
              <TableHead className="text-right">{props.t("credit.subtotal")}</TableHead>
              <TableHead className="text-right">{props.t("credit.billDiscount")}</TableHead>
              <TableHead className="text-right">{props.t("credit.serviceCharge")}</TableHead>
              <TableHead className="text-right">{props.t("credit.vat")}</TableHead>
              <TableHead className="text-right">{props.t("credit.grandTotal")}</TableHead>
              <TableHead className="text-right">{props.t("credit.outstanding")}</TableHead>
              <TableHead className="min-w-32 text-right">{props.t("credit.payThisTime")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.bills.map((bill) => {
              const selected = props.selectedUuids.includes(bill.payment_uuid);
              return (
                <TableRow key={bill.payment_uuid} data-state={selected ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox disabled={props.disabled} checked={selected} onCheckedChange={(checked) => props.onSelect(bill, checked as boolean)} aria-label={`${props.t("credit.invoice")} ${bill.invoice_no}`} />
                  </TableCell>
                  <TableCell className="font-bold">{bill.invoice_no || "-"}</TableCell>
                  <TableCell>{dateLabel(bill.sale_date)}</TableCell>
                  <TableCell>{dateLabel(bill.due_date)}</TableCell>
                  <TableCell className="text-right">{bill.order_qty ?? 0}</TableCell>
                  <TableCell className="text-right">{money(bill.subtotal)}</TableCell>
                  <TableCell className="text-right">{money(bill.discount)}</TableCell>
                  <TableCell className="text-right">{money(bill.service_charge)}</TableCell>
                  <TableCell className="text-right">{money(bill.vat)}</TableCell>
                  <TableCell className="text-right">{money(bill.bill_total)}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{money(bill.balance)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {selected ? money(bill.balance) : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CreditBillDetail({
  bill,
  loading,
  customer,
  t
}: {
  bill: CreditSingleBillDetail | null | undefined;
  loading: boolean;
  customer?: CreditCustomer & { member_code?: string };
  t: (key: string) => string;
}) {
  if (loading) return <CreditTableSkeleton />;
  if (!bill) return null;

  return (
    <Card className="mt-3">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("credit.billDetail")} · {bill.invoice_no}</CardTitle>
          <Badge variant="outline"><Users className="mr-1 size-3" />{customer?.customer_name || "-"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid gap-2 rounded-md border bg-card p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <DetailValue label={t("credit.invoice")} value={bill.invoice_no || "-"} />
          <DetailValue label={t("credit.outstanding")} value={money(bill.balance)} />
          <DetailValue label={t("credit.saleDate")} value={dateLabel(bill.sale_date)} />
          <DetailValue label={t("credit.dueDate")} value={dateLabel(bill.due_date)} />
        </div>
        <div className="mb-3 grid gap-2 rounded-md border bg-muted/25 p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <DetailValue label={t("credit.memberCode")} value={customer?.member_code || "-"} />
          <DetailValue label={t("credit.customer")} value={customer?.customer_name || "-"} />
          <DetailValue label={t("credit.phone")} value={customer?.customer_phone || "-"} />
          <DetailValue label={t("credit.address")} value={customer?.customer_address || "-"} />
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("credit.productCode")}</TableHead>
                <TableHead>{t("credit.productName")}</TableHead>
                <TableHead>{t("credit.topping")}</TableHead>
                <TableHead className="text-right">{t("credit.qty")}</TableHead>
                <TableHead className="text-right">{t("credit.itemDiscount")}</TableHead>
                <TableHead className="text-right">{t("credit.lineTotal")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill.items.map((item) => (
                <TableRow key={item.order_item_uuid}>
                  <TableCell className="font-mono text-xs">{item.product_code || "-"}</TableCell>
                  <TableCell className="font-semibold">{item.product_name}</TableCell>
                  <TableCell>
                    {item.toppings.length ? (
                      <div className="flex flex-col gap-1">
                        {item.toppings.map((topping) => (
                          <div key={`${item.order_item_uuid}-${topping.topping_uuid}`} className="text-xs">
                            <span className="font-mono text-muted-foreground">{topping.topping_uuid}</span>
                            <span> · {topping.topping_name} × {topping.topping_qty} · {money(topping.topping_total)}</span>
                          </div>
                        ))}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{money(item.item_discount_amount)}</TableCell>
                  <TableCell className="text-right font-bold">{money(item.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label={t("credit.subtotal")} value={money(bill.subtotal)} />
          <SummaryCard label={t("credit.billDiscount")} value={money(bill.discount)} />
          <SummaryCard label={t("credit.serviceCharge")} value={money(bill.service_charge)} />
          <SummaryCard label={t("credit.vat")} value={money(bill.vat)} />
          <SummaryCard label={t("credit.grandTotal")} value={money(bill.grand_total)} emphasis />
        </div>
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

function CreditTableSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  );
}
