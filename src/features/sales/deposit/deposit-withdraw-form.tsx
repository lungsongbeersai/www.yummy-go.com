"use client";

import { useEffect, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Check, ChevronsUpDown, PackageSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { Customer } from "@/services/customer";
import type { DepositRow } from "@/services/deposit";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useDepositStore } from "@/stores/deposit-store";
import { useToastStore } from "@/stores/toast-store";
import { toDepositQtyInput, validateDepositWithdraw } from "./deposit-utils";

const SEARCH_DEBOUNCE_MS = 300;
const PICKER_LIMIT = 20;

function customerUuidOf(customer: Customer) {
  return String(customer.customer_uuid ?? "").trim();
}

function customerLabel(customer: Customer) {
  return customer.customer_phone
    ? `${customer.customer_name || "-"} · ${customer.customer_phone}`
    : customer.customer_name || "-";
}

function validationKey(error: string | null) {
  return error ? `deposit.validation.withdraw${error.charAt(0).toUpperCase()}${error.slice(1)}` : "";
}

export function DepositWithdrawForm({
  branchUuid,
  open,
  onOpenChange,
  orderUuid
}: {
  branchUuid?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderUuid?: string;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);

  const rows = useDepositStore((state) => state.rows);
  const loading = useDepositStore((state) => state.loading);
  const withdrawing = useDepositStore((state) => state.withdrawing);
  const loadList = useDepositStore((state) => state.loadList);
  const withdrawAction = useDepositStore((state) => state.withdraw);
  const showToast = useToastStore((state) => state.show);

  const customerRows = useCustomerStore((state) => state.rows);
  const customerLoading = useCustomerStore((state) => state.loading);
  const loadCustomers = useCustomerStore((state) => state.load);

  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerUuid, setCustomerUuid] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [selected, setSelected] = useState<DepositRow | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const qty = toDepositQtyInput(qtyInput);
  const validationError = validateDepositWithdraw({ qtyWithdrawn: qty, deposit: selected });
  const exceedsRemaining = Boolean(selected) && qty > (selected?.remaining_qty ?? 0);

  useResetOnChange(open, () => {
    setCustomerOpen(false);
    setCustomerSearch("");
    setCustomerUuid("");
    setSelectedCustomer(null);
    setSelected(null);
    setQtyInput("");
    setNote("");
    setConfirmOpen(false);
  });

  useEffect(() => {
    if (!storeUuid || !customerOpen) return;
    const query = customerSearch.trim();
    const timer = window.setTimeout(() => {
      void loadCustomers({ store_uuid_fk: storeUuid, search: query, limit: PICKER_LIMIT, lang: language });
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [customerOpen, customerSearch, language, loadCustomers, storeUuid]);

  // เลือกลูกค้าแล้ว = โหลดรายการฝากที่ยัง Active ของลูกค้าคนนั้นมาแสดงเป็นลิสต์
  // ให้เห็นชัดว่ามีอะไรให้เบิกบ้าง ไม่ใช่ให้พิมพ์ค้นหาแบบเดา
  useEffect(() => {
    if (!branchUuid || !customerUuid) return;
    void loadList({ branchUuid, customerUuid, status: "active", lang: language });
  }, [branchUuid, customerUuid, language, loadList]);

  function selectCustomer(customer: Customer) {
    setCustomerUuid(customerUuidOf(customer));
    setSelectedCustomer(customer);
    setCustomerOpen(false);
    setSelected(null);
    setQtyInput("");
  }

  function selectDeposit(row: DepositRow) {
    setSelected(row);
    setQtyInput(String(row.remaining_qty));
  }

  function requestConfirmation() {
    if (validationError) {
      showToast({ title: t(validationKey(validationError)), tone: "error" });
      return;
    }
    setConfirmOpen(true);
  }

  async function submitWithdraw() {
    if (validationError || withdrawing || !selected) return;

    try {
      await withdrawAction({
        request_uuid: crypto.randomUUID(),
        deposit_uuid: selected.deposit_uuid,
        order_uuid: orderUuid,
        qty_withdrawn: qty,
        note: note.trim(),
        lang: language
      });
      setConfirmOpen(false);
      onOpenChange(false);
      showToast({ title: t("deposit.withdrawSuccess"), tone: "success" });
    } catch (withdrawError) {
      showToast({
        title: t("deposit.withdrawFailed"),
        description: withdrawError instanceof Error ? withdrawError.message : "",
        tone: "error"
      });
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
          <Field>
            <FieldLegend className="text-sm">{t("deposit.customer")}</FieldLegend>
            <FieldDescription>{t("deposit.findDepositHint")}</FieldDescription>
          </Field>
          <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={customerOpen}
                disabled={withdrawing}
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
        </FieldSet>

        {customerUuid ? (
          <FieldSet className="gap-3 rounded-lg border border-border bg-card p-4">
            <Field>
              <FieldLegend className="flex items-center gap-2 text-sm">
                <PackageSearch className="size-4 text-primary" aria-hidden />
                {t("deposit.findDeposit")}
              </FieldLegend>
            </Field>

            {loading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : rows.length ? (
              <div className="flex flex-col gap-2">
                {rows.map((row) => {
                  const isSelected = selected?.deposit_uuid === row.deposit_uuid;
                  return (
                    <button
                      key={row.deposit_uuid}
                      type="button"
                      disabled={withdrawing}
                      onClick={() => selectDeposit(row)}
                      className={
                        "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors " +
                        (isSelected ? "border-primary bg-primary/5" : "border-border bg-muted/25 hover:bg-muted/50")
                      }
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.product_name}</p>
                        <p className="text-xs text-muted-foreground">{row.deposit_no}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline">
                          {t("deposit.remaining")}: {row.remaining_qty} {row.unit_name}
                        </Badge>
                        <Check className={isSelected ? "size-4 opacity-100" : "size-4 opacity-0"} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("deposit.noDeposits")}</p>
            )}
          </FieldSet>
        ) : null}

        {selected ? (
          <FieldSet className="gap-4 rounded-lg border border-border bg-muted/25 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pos-withdraw-qty">{t("deposit.withdrawQty")}</FieldLabel>
                <Input
                  id="pos-withdraw-qty"
                  type="number"
                  min="0"
                  max={selected.remaining_qty}
                  step="0.01"
                  inputMode="decimal"
                  disabled={withdrawing}
                  aria-invalid={exceedsRemaining}
                  value={qtyInput}
                  onChange={(event) => setQtyInput(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pos-withdraw-note">{t("deposit.note")}</FieldLabel>
                <Input
                  id="pos-withdraw-note"
                  disabled={withdrawing}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("deposit.withdrawNotePlaceholder")}
                />
              </Field>
            </div>
          </FieldSet>
        ) : null}

        {validationError && selected ? (
          <p className="text-sm font-medium text-destructive">{t(validationKey(validationError))}</p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={withdrawing} onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
        <Button type="button" disabled={withdrawing || !selected || Boolean(validationError)} onClick={requestConfirmation}>
          {withdrawing ? t("deposit.saving") : t("deposit.withdrawSubmit")}
        </Button>
      </DialogFooter>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deposit.withdrawConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deposit.withdrawConfirmDescription", { qty, unit: selected?.unit_name ?? "" })}
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
    </>
  );
}
