"use client";

import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { cn } from "@/lib/utils";
import type { Customer } from "@/services/customer";
import type { DepositRow } from "@/services/deposit";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDepositStore } from "@/stores/deposit-store";
import { useToastStore } from "@/stores/toast-store";
import { DepositCustomerPicker } from "./components/deposit-customer-picker";
import { formatDepositDate, formatDepositQuantity } from "./deposit-order-items";
import { DepositQtyStepper } from "./deposit-qty-stepper";
import { toDepositQtyInput, validateDepositWithdraw } from "./deposit-utils";

interface CustomerDeposits {
  key: string;
  rows: DepositRow[];
  error: string | null;
}

function productCode(row: DepositRow) {
  if (row.product_code?.trim()) return row.product_code.trim();
  return "prod_code" in row && typeof row.prod_code === "string" ? row.prod_code.trim() : "";
}

function available(row: DepositRow) {
  return row.status === "ACTIVE" && !row.is_expired && row.remaining_qty > 0;
}

function validationKey(error: string | null) {
  return error ? `deposit.validation.withdraw${error.charAt(0).toUpperCase()}${error.slice(1)}` : "";
}

export function DepositWithdrawForm({
  branchUuid, open, onCompleted, onOpenChange, orderUuid
}: {
  branchUuid?: string;
  open: boolean;
  onCompleted?: () => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  orderUuid?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const effectiveBranchUuid = branchUuid?.trim() || user?.branch_uuid?.trim() || "";
  const loadList = useDepositStore((state) => state.loadList);
  const withdraw = useDepositStore((state) => state.withdraw);
  const saving = useDepositStore((state) => state.saving);
  const withdrawing = useDepositStore((state) => state.withdrawing);
  const printing = useDepositStore((state) => state.printing);
  const reprinting = useDepositStore((state) => state.reprinting);
  const showToast = useToastStore((state) => state.show);
  const busy = saving || withdrawing || printing || reprinting;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [list, setList] = useState<CustomerDeposits>({ key: "", rows: [], error: null });
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedUuid, setSelectedUuid] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const customerUuid = customer?.customer_uuid?.trim() || "";
  const listKey = `${open}:${effectiveBranchUuid}:${customerUuid}:${language}:${reload}`;
  const loaded = list.key === listKey;
  const loading = Boolean(open && customerUuid && effectiveBranchUuid && !loaded);
  const scopedRows = loaded ? list.rows.filter((row) => row.branch_uuid_fk === effectiveBranchUuid
    && row.customer_uuid_fk === customerUuid) : [];
  const query = search.trim().toLocaleLowerCase();
  const visibleRows = scopedRows.filter((row) => [row.product_name, productCode(row), row.deposit_no]
    .some((value) => value.toLocaleLowerCase().includes(query)));
  const selected = scopedRows.find((row) => row.deposit_uuid === selectedUuid) || null;
  const qty = toDepositQtyInput(qtyInput);
  const validationError = validateDepositWithdraw({ qtyWithdrawn: qty, deposit: selected });
  const after = selected && !validationError ? Math.round((selected.remaining_qty - qty) * 1000) / 1000 : null;

  useResetOnChange(`${open}:${effectiveBranchUuid}`, () => {
    setCustomer(null);
    setList({ key: "", rows: [], error: null });
    setSearch("");
    setSelectedUuid("");
    setQtyInput("");
    setNote("");
    setConfirmOpen(false);
    setSubmitError(null);
  });

  useEffect(() => {
    if (!open || !effectiveBranchUuid || !customerUuid) return;
    let current = true;
    // Other POS panels share the store list. Only this response's customer
    // and branch may supply rows for this withdrawal selection.
    void loadList({ branchUuid: effectiveBranchUuid, customerUuid, status: "active", lang: language })
      .then((rows) => { if (current) setList({ key: listKey, rows, error: null }); })
      .catch((error: unknown) => {
        if (current) setList({ key: listKey, rows: [], error: error instanceof Error ? error.message : t("deposit.withdrawListFailed") });
      });
    return () => { current = false; };
  }, [customerUuid, effectiveBranchUuid, language, listKey, loadList, open, t]);

  function selectCustomer(value: Customer) {
    setCustomer(value);
    setReload((value) => value + 1);
    setSelectedUuid("");
    setQtyInput("");
    setSearch("");
    setNote("");
    setSubmitError(null);
    setConfirmOpen(false);
  }

  function selectDeposit(value: string) {
    const row = scopedRows.find((deposit) => deposit.deposit_uuid === value);
    if (!row || !available(row) || busy) return;
    setSelectedUuid(value);
    setQtyInput(formatDepositQuantity(Math.min(1, row.remaining_qty)));
    setSubmitError(null);
  }

  function requestConfirmation() {
    if (!effectiveBranchUuid || !customerUuid || loading || list.error || !selected || busy) return;
    if (validationError) {
      showToast({ title: t(validationKey(validationError)), tone: "error" });
      return;
    }
    setSubmitError(null);
    setConfirmOpen(true);
  }

  async function submitWithdraw() {
    if (validationError || busy || !selected || !customerUuid || !effectiveBranchUuid) return;
    setSubmitError(null);
    try {
      // The store retains the action identity across an ambiguous response.
      // Receipt failures must never become another business withdrawal.
      await withdraw({ deposit_uuid: selected.deposit_uuid, order_uuid: orderUuid,
        qty_withdrawn: qty, note: note.trim(), lang: language });
      setConfirmOpen(false);
      try {
        await onCompleted?.();
      } catch (error) {
        showToast({ title: t("pos.orderFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
      }
      // Keep this dialog open: its parent renders the committed receipt state.
    } catch (error) {
      const message = error instanceof Error ? error.message : t("deposit.withdrawFailed");
      setSubmitError(message);
      showToast({ title: t("deposit.withdrawFailed"), description: message, tone: "error" });
    }
  }

  return <>
    <div className="min-h-0 flex-1 flex flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">
      <DepositCustomerPicker value={customer} onChange={selectCustomer} disabled={busy} />
      {!effectiveBranchUuid ? <Alert variant="destructive"><AlertDescription>{t("deposit.branchRequired")}</AlertDescription></Alert> : null}

      {!customerUuid ? <Empty className="min-h-40 border-0 px-0 py-7">
        <EmptyHeader><EmptyTitle className="text-sm">{t("deposit.selectCustomer")}</EmptyTitle>
          <EmptyDescription className="text-xs">{t("deposit.customerRequiredHint")}</EmptyDescription></EmptyHeader>
      </Empty> : <section aria-label={t("deposit.findDeposit")} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{t("deposit.findDeposit")}</h3>
          {loaded && !list.error ? <span className="text-xs tabular-nums text-muted-foreground">{visibleRows.length} / {scopedRows.length}</span> : null}
        </div>
        <Input type="search" className="h-10" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder={t("deposit.withdrawSearchPlaceholder")} aria-label={t("deposit.withdrawSearchPlaceholder")} disabled={busy || loading} />

        {loading ? <div aria-label={t("common.loading")} className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => <Skeleton key={row} className="h-20 w-full rounded-lg" />)}
        </div> : loaded && list.error ? <Alert variant="destructive">
          <AlertTitle>{t("deposit.withdrawListFailed")}</AlertTitle>
          <AlertDescription><p>{list.error}</p><Button type="button" variant="outline" className="mt-2 h-10"
            disabled={busy} onClick={() => setReload((value) => value + 1)}>{t("deposit.retry")}</Button></AlertDescription>
        </Alert> : visibleRows.length ? <RadioGroup value={selectedUuid} onValueChange={selectDeposit} disabled={busy}
          aria-label={t("deposit.findDeposit")} className="gap-0 overflow-hidden rounded-lg border divide-y">
          {visibleRows.map((row) => {
            const rowId = `${id}-${row.deposit_uuid}`;
            const eligible = available(row);
            const code = productCode(row);
            return <label key={row.deposit_uuid} htmlFor={rowId} className={cn(
              "grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 transition-colors",
              eligible && !busy ? "cursor-pointer hover:bg-muted/50" : "cursor-not-allowed opacity-60",
              selectedUuid === row.deposit_uuid && "bg-primary/5"
            )}>
              <RadioGroupItem id={rowId} value={row.deposit_uuid} disabled={!eligible || busy} className="mt-1" />
              <div className="min-w-0 flex flex-col gap-1">
                <p className="break-words text-sm font-medium leading-snug">{row.product_name}</p>
                <p className="break-words text-xs text-muted-foreground">{code ? `${code} · ` : ""}{row.deposit_no}</p>
                <p className={cn("text-xs", row.is_expired ? "text-destructive" : "text-muted-foreground")}>
                  {t("deposit.expireDate")}: {formatDepositDate(row.expire_date)}
                </p>
              </div>
              <div className="max-w-28 flex flex-col gap-0.5 text-right">
                <p className="text-xs text-muted-foreground">{t("deposit.remaining")}</p>
                <p className="break-words text-sm font-semibold tabular-nums">{formatDepositQuantity(row.remaining_qty)}</p>
                <p className="break-words text-xs text-muted-foreground">{row.unit_name}</p>
              </div>
            </label>;
          })}
        </RadioGroup> : <Empty className="min-h-36 rounded-lg border border-dashed px-4 py-6">
          <EmptyHeader><EmptyTitle className="text-sm">{t(query ? "deposit.withdrawNoMatches" : "deposit.withdrawNoDeposits")}</EmptyTitle>
            <EmptyDescription className="text-xs">{t("deposit.noDepositsHelp")}</EmptyDescription></EmptyHeader>
        </Empty>}
      </section>}

      {selected ? <section className="flex flex-col gap-4 border-t pt-4" aria-label={t("deposit.withdrawQty")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1"><p className="text-sm font-medium">{t("deposit.withdrawQty")}</p>
            <p className="text-xs text-muted-foreground">{selected.unit_name}</p></div>
          <DepositQtyStepper qty={qty} rawValue={qtyInput} onRawChange={setQtyInput}
            onChange={(value) => setQtyInput(formatDepositQuantity(value))} maxQty={selected.remaining_qty} minQty={0.001}
            label={t("deposit.withdrawQty")} invalid={Boolean(validationError)} disabled={busy} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{t("deposit.remainingAfter")}</span>
          <span className="text-sm font-semibold tabular-nums">{after === null ? "—" : formatDepositQuantity(after)} {selected.unit_name}</span>
        </div>
        {validationError ? <p role="alert" className="text-xs text-destructive">{t(validationKey(validationError))}</p> : null}
        <div className="flex flex-col gap-2"><Label htmlFor={`${id}-note`}>{t("deposit.note")} <span className="font-normal text-muted-foreground">{t("deposit.optional")}</span></Label>
          <Input id={`${id}-note`} className="h-10" value={note} onChange={(event) => setNote(event.target.value)}
            disabled={busy} placeholder={t("deposit.withdrawNotePlaceholder")} /></div>
      </section> : null}
    </div>

    <DialogFooter className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
      <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button>
      <Button type="button" className="h-10" disabled={busy || loading || !selected || Boolean(validationError) || !effectiveBranchUuid}
        onClick={requestConfirmation}>{withdrawing ? <Spinner /> : null}{t(withdrawing ? "deposit.saving" : "deposit.collectAndPrint")}</Button>
    </DialogFooter>

    <AlertDialog open={confirmOpen && Boolean(selected)} onOpenChange={(next) => !busy && setConfirmOpen(next)}>
      <AlertDialogContent className="sm:max-w-md font-lao">
        <AlertDialogHeader><AlertDialogTitle>{t("deposit.withdrawConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deposit.withdrawConfirmDescription", { qty: formatDepositQuantity(qty), unit: selected?.unit_name || "" })}</AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="flex flex-col gap-3 border-y py-4 text-sm">
          <div className="flex items-start justify-between gap-4"><dt className="shrink-0 text-muted-foreground">{t("deposit.customer")}</dt>
            <dd className="min-w-0 break-words text-right font-medium">{customer?.customer_name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{customer?.customer_phone}</span></dd></div>
          <div className="flex items-start justify-between gap-4"><dt className="shrink-0 text-muted-foreground">{t("deposit.product")}</dt>
            <dd className="min-w-0 break-words text-right font-medium">{selected?.product_name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{selected ? productCode(selected) : ""}</span></dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("deposit.remaining")}</dt>
            <dd className="text-right tabular-nums">{formatDepositQuantity(selected?.remaining_qty || 0)} {selected?.unit_name}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("deposit.withdrawQty")}</dt>
            <dd className="text-right font-semibold tabular-nums">{formatDepositQuantity(qty)} {selected?.unit_name}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("deposit.remainingAfter")}</dt>
            <dd className="text-right font-semibold tabular-nums">{after === null ? "—" : formatDepositQuantity(after)} {selected?.unit_name}</dd></div>
        </dl>
        {submitError ? <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert> : null}
        <AlertDialogFooter><AlertDialogCancel className="h-10" disabled={busy}>{t("actions.cancel")}</AlertDialogCancel>
          <Button type="button" className="h-10" disabled={busy || Boolean(validationError)} onClick={() => void submitWithdraw()}>
            {withdrawing ? <Spinner /> : null}{t(withdrawing ? "deposit.saving" : "deposit.collectAndPrint")}
          </Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
