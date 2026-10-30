"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageOpen, Printer, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { cn } from "@/lib/utils";
import type { Customer } from "@/services/customer";
import type { CartItem } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDepositStore } from "@/stores/deposit-store";
import { useToastStore } from "@/stores/toast-store";
import { DepositCustomerPicker } from "./components/deposit-customer-picker";
import { depositableOrderItems, formatDepositDate, formatDepositQuantity } from "./deposit-order-items";
import { DepositQtyStepper } from "./deposit-qty-stepper";
import { depositDateSchedule, depositedQuantityByProduct, toDepositQtyInput, validateDepositCreate } from "./deposit-utils";

interface DepositCreateFormProps {
  open: boolean;
  branchUuid?: string;
  onOpenChange: (open: boolean) => void;
  orderItems: CartItem[];
  orderUuid?: string;
}

export function DepositCreateForm({ open, branchUuid, onOpenChange, orderItems, orderUuid }: DepositCreateFormProps) {
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
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [selectedQty, setSelectedQty] = useState<Map<string, string>>(new Map());
  const [now, setNow] = useState(() => new Date());
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deposited = useMemo(() => depositedQuantityByProduct(orderDeposits), [orderDeposits]);
  const items = useMemo(() => depositableOrderItems(orderItems, deposited), [deposited, orderItems]);
  const hasEligibleItems = useMemo(() => depositableOrderItems(orderItems, new Map()).length > 0, [orderItems]);
  const schedule = useMemo(() => depositDateSchedule(user?.deposit_expire_days, now), [now, user?.deposit_expire_days]);
  const availabilityPending = Boolean(orderUuid) && (loadedOrderUuid !== orderUuid || availabilityLoading);
  const draftItems = useMemo(() => items.filter((item) => selectedQty.has(item.key)).map((item) => ({
    ...item, qty: toDepositQtyInput(selectedQty.get(item.key))
  })), [items, selectedQty]);
  const validationError = validateDepositCreate({ customerUuid: customer?.customer_uuid || "", items: draftItems });
  const exceedsAvailable = draftItems.some((item) => item.qty > item.availableQty);
  const canSubmit = Boolean(orderUuid && resolvedBranchUuid && schedule.expireDate) &&
    !availabilityPending && !availabilityError && !validationError && !exceedsAvailable && !saving;

  useResetOnChange(open, () => {
    setCustomer(null); setSelectedQty(new Map()); setNow(new Date()); setNote(""); setConfirmOpen(false);
  });

  useEffect(() => {
    if (!open || !orderUuid || !resolvedBranchUuid) return;
    void loadOrderDeposits({ branchUuid: resolvedBranchUuid, orderUuid, lang: language }).catch(() => undefined);
  }, [language, loadOrderDeposits, open, orderUuid, resolvedBranchUuid]);

  function toggleItem(key: string, max: number, checked: boolean) {
    setSelectedQty((current) => {
      const next = new Map(current);
      if (checked) next.set(key, String(max)); else next.delete(key);
      return next;
    });
  }

  async function submit() {
    if (!canSubmit || !orderUuid || !customer) return;
    try {
      await createDeposit({ branch_uuid: resolvedBranchUuid, customer_uuid: customer.customer_uuid,
        order_uuid: orderUuid, items: draftItems.map((item) => ({ pro_detail_uuid: item.proDetailUuid, deposit_qty: item.qty })),
        note: note.trim(), lang: language });
      setConfirmOpen(false);
    } catch (error) {
      setConfirmOpen(false);
      showToast({ title: t("deposit.createFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    }
  }

  return (
    <>
      <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
        <DepositCustomerPicker allowCreate disabled={saving} value={customer} onChange={setCustomer} />
        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-6">
          <section className="min-w-0 flex flex-col gap-3" aria-labelledby="deposit-order-items-title">
            <div className="flex items-center justify-between gap-2">
              <h3 id="deposit-order-items-title" className="text-sm font-semibold">{t("deposit.itemsFromOrder")}</h3>
              {items.length ? <span className="text-xs tabular-nums text-muted-foreground">{t("deposit.selectionCount", { selected: draftItems.length, total: items.length })}</span> : null}
            </div>
            {availabilityPending ? <div className="flex flex-col gap-2" role="status" aria-label={t("deposit.checkingAvailability")}>
              <Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" />
            </div> : availabilityError ? <Alert variant="destructive">
              <AlertTitle>{t("deposit.availabilityLoadFailed")}</AlertTitle>
              <AlertDescription>{availabilityError}<Button type="button" size="sm" variant="outline" className="mt-2"
                onClick={() => { if (orderUuid) void loadOrderDeposits({ branchUuid: resolvedBranchUuid, orderUuid, lang: language }).catch(() => undefined); }}>
                <RefreshCw className="size-3.5" />{t("deposit.retry")}</Button></AlertDescription>
            </Alert> : items.length ? <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span>{t("deposit.product")}</span><span>{t("deposit.depositQuantity")}</span>
              </div>
              <div className="divide-y divide-border">
                {items.map((item) => {
                  const checked = selectedQty.has(item.key);
                  const qty = toDepositQtyInput(selectedQty.get(item.key));
                  const invalid = checked && (qty <= 0 || qty > item.availableQty || Boolean(validateDepositCreate({ customerUuid: "selected", items: [{ proDetailUuid: item.proDetailUuid, qty }] })));
                  return <div key={item.key} className={cn("flex flex-col gap-2 px-3 py-3", checked && "bg-primary/5")}>
                    <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                      <Checkbox id={"deposit-item-" + item.key} className="mt-1" checked={checked} disabled={saving}
                        onCheckedChange={(value) => toggleItem(item.key, item.availableQty, value === true)} aria-label={item.name} />
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={"deposit-item-" + item.key} className="block leading-relaxed font-medium">{item.name}</Label>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t("deposit.productCode")}: <span className="font-mono text-foreground">{item.productCode || "—"}</span></p>
                        <p className="mt-1 text-xs text-muted-foreground">{t("deposit.availableShort")}: <span className="tabular-nums">{formatDepositQuantity(item.availableQty)}</span> {item.unitName}</p>
                      </div>
                      {checked ? <DepositQtyStepper qty={qty} maxQty={item.availableQty} minQty={0.001} disabled={saving} invalid={invalid}
                        rawValue={selectedQty.get(item.key) || ""} onRawChange={(value) => setSelectedQty((current) => new Map(current).set(item.key, value))}
                        label={t("deposit.depositQuantity") + " " + item.name} onChange={(value) => setSelectedQty((current) => new Map(current).set(item.key, String(value)))} /> :
                        <Button type="button" variant="ghost" size="sm" disabled={saving} className="shrink-0" onClick={() => toggleItem(item.key, item.availableQty, true)}>{t("deposit.selectItem")}</Button>}
                    </div>
                    {invalid ? <p className="pl-7 text-xs text-destructive">{t(qty > item.availableQty ? "deposit.validation.createQtyExceedsOrdered" : "deposit.validation.createQtyInvalid")}</p> : null}
                  </div>;
                })}
              </div>
            </div> : <Empty className="min-h-44 border border-border bg-muted/15 px-4">
              <EmptyHeader><EmptyMedia variant="icon"><PackageOpen /></EmptyMedia>
                <EmptyTitle>{t(!orderUuid ? "deposit.orderRequired" : hasEligibleItems ? "deposit.noRemainingOrderItems" : "deposit.noEligibleOrderItems")}</EmptyTitle>
                <EmptyDescription>{t("deposit.eligibleOrderHint")}</EmptyDescription></EmptyHeader>
            </Empty>}
            <p className="text-xs leading-relaxed text-muted-foreground">{t("deposit.itemsFromOrderHint")}</p>
          </section>

          <aside className="min-w-0 flex flex-col gap-4 rounded-lg bg-muted/35 p-4 md:self-start" aria-label={t("deposit.depositDetails")}>
            <h3 className="text-sm font-semibold">{t("deposit.depositDetails")}</h3>
            <dl className="flex flex-col gap-3 text-xs">
              <div><dt className="text-muted-foreground">{t("deposit.depositDate")}</dt><dd className="mt-1 text-sm font-medium tabular-nums"><time dateTime={schedule.depositDate}>{formatDepositDate(schedule.depositDate)}</time></dd></div>
              <div><dt className="text-muted-foreground">{t("deposit.expireDate")}</dt><dd className="mt-1 text-sm font-medium tabular-nums">{schedule.expireDate ? <time dateTime={schedule.expireDate}>{formatDepositDate(schedule.expireDate)}</time> : t("deposit.expireDateNotSet")}</dd></div>
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">{t(schedule.expireDate ? "deposit.expireDateHelp" : "deposit.expireDateNotSetHint")}</p>
            <div className="flex flex-col gap-2"><Label htmlFor="pos-deposit-note">{t("deposit.note")} <span className="font-normal text-muted-foreground">{t("deposit.optional")}</span></Label>
              <Textarea id="pos-deposit-note" rows={3} maxLength={1000} disabled={saving} value={note}
                onChange={(event) => setNote(event.target.value)} placeholder={t("deposit.notePlaceholder")} className="min-h-20 resize-none bg-background" /></div>
          </aside>
        </div>
      </div>

      <DialogFooter className="shrink-0 items-stretch border-t border-border bg-background px-5 py-4 sm:items-center sm:px-6">
        <p className="mr-auto hidden text-xs text-muted-foreground sm:block">{t(!customer ? "deposit.selectCustomerToContinue" : !draftItems.length ? "deposit.selectItemsToContinue" : "deposit.receiptAfterSave")}</p>
        <Button type="button" variant="outline" className="h-10" disabled={saving} onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button>
        <Button type="button" className="h-10" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}><Printer className="size-4" />{t(saving ? "deposit.saving" : "deposit.saveAndPrint")}</Button>
      </DialogFooter>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => !saving && setConfirmOpen(next)}>
        <AlertDialogContent className="sm:max-w-md"><AlertDialogHeader>
          <AlertDialogTitle>{t("deposit.createConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deposit.createConfirmDescriptionMulti", { customer: customer?.customer_name || "", count: draftItems.length })}</AlertDialogDescription>
        </AlertDialogHeader>
          <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border px-3">
            {draftItems.map((item) => <div key={item.key} className="flex items-start justify-between gap-3 py-3 text-sm"><span>{item.name}<span className="mt-1 block font-mono text-xs text-muted-foreground">{item.productCode || "—"}</span></span><span className="shrink-0 font-medium tabular-nums">{formatDepositQuantity(item.qty)} {item.unitName}</span></div>)}
          </div>
          <AlertDialogFooter><AlertDialogCancel disabled={saving}>{t("actions.cancel")}</AlertDialogCancel><Button disabled={!canSubmit} onClick={() => void submit()}>{t(saving ? "deposit.saving" : "deposit.saveAndPrint")}</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
