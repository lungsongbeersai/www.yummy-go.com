"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { cn } from "@/lib/utils";
import type { Customer } from "@/services/customer";
import type { CartItem } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDepositStore } from "@/stores/deposit-store";
import { useToastStore } from "@/stores/toast-store";
import { buildDepositCreateDraft } from "./deposit-create-draft";
import { depositableOrderItems, formatDepositDate, formatDepositQuantity } from "./deposit-order-items";
import { DepositQtyStepper } from "./deposit-qty-stepper";
import { depositDateSchedule, depositedQuantityByProduct, validateDepositCreate } from "./deposit-utils";

interface DepositCreateFormProps {
  customer: Customer | null;
  open: boolean;
  branchUuid?: string;
  onOpenChange: (open: boolean) => void;
  orderItems: CartItem[];
  orderUuid?: string;
}

export function DepositCreateForm({ customer, open, branchUuid, onOpenChange, orderItems, orderUuid }: DepositCreateFormProps) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const resolvedBranchUuid = branchUuid || user?.branch_uuid || "";
  const saving = useDepositStore((state) => state.saving);
  const orderDeposits = useDepositStore((state) => state.orderRows);
  const loadedOrderUuid = useDepositStore((state) => state.loadedOrderUuid);
  const availabilityLoading = useDepositStore((state) => state.orderLoading);
  const availabilityError = useDepositStore((state) => state.orderError);
  const loadOrderDeposits = useDepositStore((state) => state.loadOrderDeposits);
  const createDeposit = useDepositStore((state) => state.create);
  const showToast = useToastStore((state) => state.show);
  const [enteredQty, setEnteredQty] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const customerUuid = customer?.customer_uuid || "";

  const deposited = useMemo(() => depositedQuantityByProduct(orderDeposits), [orderDeposits]);
  const items = useMemo(() => depositableOrderItems(orderItems, deposited), [deposited, orderItems]);
  const hasEligibleItems = useMemo(() => depositableOrderItems(orderItems, new Map()).length > 0, [orderItems]);
  const schedule = useMemo(() => depositDateSchedule(user?.deposit_expire_days, now), [now, user?.deposit_expire_days]);
  const availabilityPending = Boolean(orderUuid) && (loadedOrderUuid !== orderUuid || availabilityLoading);
  const draft = useMemo(() => buildDepositCreateDraft(items, enteredQty), [enteredQty, items]);
  const query = search.trim().toLocaleLowerCase();
  const visibleItems = items.filter((item) => [item.name, item.productCode].some((value) => value.toLocaleLowerCase().includes(query)));
  const validationError = validateDepositCreate({ customerUuid, items: draft.items });
  const canSubmit = Boolean(orderUuid && resolvedBranchUuid && schedule.expireDate) && !availabilityPending &&
    !availabilityError && !validationError && draft.invalidKeys.size === 0 && !saving;

  useResetOnChange(`${open}:${orderUuid || ""}:${customerUuid}`, () => {
    setEnteredQty(new Map()); setSearch(""); setNow(new Date()); setNote("");
    setConfirmOpen(false); setSubmitError(null);
  });

  useEffect(() => {
    if (!open || !orderUuid || !resolvedBranchUuid) return;
    void loadOrderDeposits({ branchUuid: resolvedBranchUuid, orderUuid, lang: language }).catch(() => undefined);
  }, [language, loadOrderDeposits, open, orderUuid, resolvedBranchUuid]);

  function setQuantity(key: string, value: string) {
    if (!customerUuid || saving) return;
    setEnteredQty((current) => new Map(current).set(key, value));
  }

  async function submit() {
    if (!canSubmit || !orderUuid || !customer) return;
    setSubmitError(null);
    try {
      await createDeposit({ branch_uuid: resolvedBranchUuid, customer_uuid: customer.customer_uuid,
        order_uuid: orderUuid, items: draft.items.map((item) => ({ pro_detail_uuid: item.proDetailUuid, deposit_qty: item.qty })),
        note: note.trim(), lang: language });
      setConfirmOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("deposit.createFailed");
      setSubmitError(message);
      showToast({ title: t("deposit.createFailed"), description: message, tone: "error" });
    }
  }

  return <>
    <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-6">
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="deposit-order-items-title">
          <div className="flex items-start justify-between gap-3">
            <h3 id="deposit-order-items-title" className="text-sm font-semibold">{t("deposit.itemsFromOrder")}</h3>
            {items.length ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t("deposit.selectionCount", { selected: draft.items.length, total: items.length })}</span> : null}
          </div>
          <Input type="search" className="h-10" value={search} onChange={(event) => setSearch(event.target.value)}
            aria-label={t("deposit.searchBillItems")} placeholder={t("deposit.searchBillItems")} disabled={saving || availabilityPending} />
          <p className="text-xs leading-relaxed text-muted-foreground">{t(!customerUuid ? "deposit.selectCustomerToContinue" : "deposit.enterReceivedHint")}</p>

          {availabilityPending ? <div className="flex flex-col gap-2" role="status" aria-label={t("deposit.checkingAvailability")}>
            <Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
          </div> : availabilityError ? <Alert variant="destructive">
            <AlertTitle>{t("deposit.availabilityLoadFailed")}</AlertTitle>
            <AlertDescription>{availabilityError}<Button type="button" size="sm" variant="outline" className="mt-2"
              onClick={() => { if (orderUuid) void loadOrderDeposits({ branchUuid: resolvedBranchUuid, orderUuid, lang: language }).catch(() => undefined); }}>
              <RefreshCw className="size-3.5" />{t("deposit.retry")}</Button></AlertDescription>
          </Alert> : visibleItems.length ? <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span>{t("deposit.product")}</span><span className="max-w-32 text-right">{t("deposit.receivedQuantity")}</span>
            </div>
            <div className="divide-y divide-border">
              {visibleItems.map((item) => {
                const raw = enteredQty.get(item.key) || "";
                const parsed = Number(raw);
                const qty = Number.isFinite(parsed) ? parsed : 0;
                const invalid = draft.invalidKeys.has(item.key);
                return <div key={item.key} className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3", qty > 0 && "bg-primary/5")}>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium leading-relaxed">{item.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t("deposit.productCode")}: <span className="font-mono text-foreground">{item.productCode || "—"}</span></p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("deposit.billedQty", { qty: formatDepositQuantity(item.orderedQty) })} {item.unitName}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{t("deposit.maxDepositQty", { qty: formatDepositQuantity(item.availableQty) })} {item.unitName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 pt-0.5">
                    <DepositQtyStepper qty={qty} maxQty={item.availableQty} minQty={0} disabled={!customerUuid || saving} invalid={invalid}
                      rawValue={raw} onRawChange={(value) => setQuantity(item.key, value)} label={t("deposit.receivedQuantity") + " " + item.name}
                      onChange={(value) => setQuantity(item.key, formatDepositQuantity(value))} />
                    <span className="max-w-32 break-words text-right text-xs text-muted-foreground">{item.unitName}</span>
                  </div>
                  {invalid ? <p role="alert" className="col-span-2 text-xs text-destructive">{t(qty > item.availableQty ? "deposit.validation.createQtyExceedsOrdered" : "deposit.validation.createQtyInvalid")}</p> : null}
                </div>;
              })}
            </div>
          </div> : <Empty className="min-h-36 rounded-lg border border-dashed border-border px-4 py-6">
            <EmptyHeader><EmptyTitle className="text-sm">{t(query ? "deposit.noMatchingBillItems" : !orderUuid ? "deposit.orderRequired" : hasEligibleItems ? "deposit.noRemainingOrderItems" : "deposit.noEligibleOrderItems")}</EmptyTitle>
              <EmptyDescription className="text-xs">{t(query ? "deposit.searchBillItems" : "deposit.eligibleOrderHint")}</EmptyDescription></EmptyHeader>
          </Empty>}
        </section>

        <aside className="flex min-w-0 flex-col gap-4 border-t border-border pt-4 md:self-start md:border-l md:border-t-0 md:pl-5 md:pt-0" aria-label={t("deposit.depositDetails")}>
          <h3 className="text-sm font-semibold">{t("deposit.depositDetails")}</h3>
          <dl className="flex flex-col gap-3 text-xs">
            <div><dt className="text-muted-foreground">{t("deposit.depositDate")}</dt><dd className="mt-1 text-sm font-medium tabular-nums"><time dateTime={schedule.depositDate}>{formatDepositDate(schedule.depositDate)}</time></dd></div>
            <div><dt className="text-muted-foreground">{t("deposit.expireDate")}</dt><dd className="mt-1 text-sm font-medium tabular-nums">{schedule.expireDate ? <time dateTime={schedule.expireDate}>{formatDepositDate(schedule.expireDate)}</time> : t("deposit.expireDateNotSet")}</dd></div>
          </dl>
          {!schedule.expireDate ? <p className="text-xs leading-relaxed text-muted-foreground">{t("deposit.expireDateNotSetHint")}</p> : null}
          <div className="flex flex-col gap-2"><Label htmlFor="pos-deposit-note">{t("deposit.note")} <span className="font-normal text-muted-foreground">{t("deposit.optional")}</span></Label>
            <Textarea id="pos-deposit-note" rows={3} maxLength={1000} disabled={!customerUuid || saving} value={note}
              onChange={(event) => setNote(event.target.value)} placeholder={t("deposit.notePlaceholder")} className="min-h-20 resize-none bg-background" /></div>
        </aside>
      </div>
    </div>

    <DialogFooter className="shrink-0 items-stretch border-t border-border bg-background px-5 py-4 sm:items-center sm:px-6">
      <p className="mr-auto hidden text-xs text-muted-foreground sm:block">{t(!customerUuid ? "deposit.selectCustomerToContinue" : !draft.items.length ? "deposit.selectItemsToContinue" : "deposit.receiptAfterSave")}</p>
      <Button type="button" variant="outline" className="h-10" disabled={saving} onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button>
      <Button type="button" className="h-10" disabled={!canSubmit} onClick={() => { setSubmitError(null); setConfirmOpen(true); }}>{t("deposit.reviewDeposit")}</Button>
    </DialogFooter>

    <AlertDialog open={confirmOpen} onOpenChange={(next) => !saving && setConfirmOpen(next)}>
      <AlertDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 font-lao sm:max-w-lg">
        <AlertDialogHeader className="shrink-0 border-b px-5 py-4"><AlertDialogTitle>{t("deposit.createConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deposit.createConfirmDescriptionMulti", { customer: customer?.customer_name || "", count: draft.items.length })}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="min-h-0 flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div><p className="text-xs text-muted-foreground">{t("deposit.customer")}</p><p className="mt-1 text-sm font-medium">{customer?.customer_name}</p>
            {customer?.customer_phone ? <p className="mt-1 text-xs text-muted-foreground">{customer.customer_phone}</p> : null}</div>
          <div className="divide-y divide-border rounded-lg border px-3">
            {draft.items.map((item) => <div key={item.key} className="flex items-start justify-between gap-3 py-3 text-sm"><span className="min-w-0 break-words">{item.name}<span className="mt-1 block font-mono text-xs text-muted-foreground">{item.productCode || "—"}</span></span><span className="shrink-0 font-medium tabular-nums">{formatDepositQuantity(item.qty)} {item.unitName}</span></div>)}
          </div>
          <dl className="grid grid-cols-2 gap-4 text-xs"><div><dt className="text-muted-foreground">{t("deposit.depositDate")}</dt><dd className="mt-1 font-medium tabular-nums">{formatDepositDate(schedule.depositDate)}</dd></div>
            <div><dt className="text-muted-foreground">{t("deposit.expireDate")}</dt><dd className="mt-1 font-medium tabular-nums">{formatDepositDate(schedule.expireDate)}</dd></div></dl>
          {note.trim() ? <div><p className="text-xs text-muted-foreground">{t("deposit.note")}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{note.trim()}</p></div> : null}
          {submitError ? <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert> : null}
        </div>
        <AlertDialogFooter className="shrink-0 border-t px-5 py-4"><AlertDialogCancel className="h-10" disabled={saving}>{t("actions.cancel")}</AlertDialogCancel>
          <Button className="h-10" disabled={!canSubmit} onClick={() => void submit()}>{saving ? <Spinner /> : null}{t(saving ? "deposit.saving" : "deposit.confirmAndPrint")}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
