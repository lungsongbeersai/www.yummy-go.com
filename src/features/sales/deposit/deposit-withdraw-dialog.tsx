"use client";

import { useEffect, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Check, ChevronsUpDown, PackageOpen } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useAppStore } from "@/stores/app-store";
import { useDepositStore } from "@/stores/deposit-store";
import { useToastStore } from "@/stores/toast-store";
import type { DepositRow } from "@/services/deposit";
import { toDepositQtyInput, validateDepositWithdraw } from "./deposit-utils";

const SEARCH_DEBOUNCE_MS = 300;

function depositOptionLabel(row: DepositRow) {
  const customer = row.customer_phone ? `${row.customer_name} · ${row.customer_phone}` : row.customer_name;
  return `${customer} — ${row.product_name} (${row.remaining_qty} ${row.unit_name})`;
}

function validationKey(error: string | null) {
  return error ? `deposit.validation.withdraw${error.charAt(0).toUpperCase()}${error.slice(1)}` : "";
}

export function DepositWithdrawDialog({
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

  const rows = useDepositStore((state) => state.rows);
  const loading = useDepositStore((state) => state.loading);
  const withdrawing = useDepositStore((state) => state.withdrawing);
  const loadList = useDepositStore((state) => state.loadList);
  const withdrawAction = useDepositStore((state) => state.withdraw);
  const showToast = useToastStore((state) => state.show);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DepositRow | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const qty = toDepositQtyInput(qtyInput);
  const validationError = validateDepositWithdraw({ qtyWithdrawn: qty, deposit: selected });

  useResetOnChange(open, () => {
    setPickerOpen(false);
    setSearch("");
    setSelected(null);
    setQtyInput("");
    setNote("");
    setConfirmOpen(false);
  });

  useEffect(() => {
    if (!branchUuid || !pickerOpen) return;
    const query = search.trim();
    const timer = window.setTimeout(() => {
      void loadList({ branchUuid, status: "active", search: query, lang: language });
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [branchUuid, language, loadList, pickerOpen, search]);

  function selectDeposit(row: DepositRow) {
    setSelected(row);
    setQtyInput(String(row.remaining_qty));
    setPickerOpen(false);
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
      <Dialog open={open} onOpenChange={(nextOpen) => !withdrawing && onOpenChange(nextOpen)}>
        <DialogContent showCloseButton={!withdrawing} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                <PackageOpen className="size-4" aria-hidden />
              </span>
              {t("deposit.withdrawTitle")}
            </DialogTitle>
            <DialogDescription>{t("deposit.withdrawDialogHint")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
              <Field>
                <FieldLegend className="text-sm">{t("deposit.findDeposit")}</FieldLegend>
                <FieldDescription>{t("deposit.findDepositHint")}</FieldDescription>
              </Field>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    disabled={withdrawing || !branchUuid}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {selected ? depositOptionLabel(selected) : t("deposit.selectDeposit")}
                    </span>
                    {loading ? <Spinner /> : <ChevronsUpDown className="opacity-50" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder={t("deposit.searchPlaceholder")}
                      value={search}
                      onValueChange={setSearch}
                    />
                    <CommandList>
                      <CommandEmpty>{loading ? t("common.loading") : t("deposit.noDeposits")}</CommandEmpty>
                      <CommandGroup>
                        {rows.map((row) => (
                          <CommandItem key={row.deposit_uuid} value={row.deposit_uuid} onSelect={() => selectDeposit(row)}>
                            {depositOptionLabel(row)}
                            <Check
                              className={
                                selected?.deposit_uuid === row.deposit_uuid ? "ml-auto opacity-100" : "ml-auto opacity-0"
                              }
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FieldSet>

            {selected ? (
              <FieldSet className="gap-4 rounded-lg border border-border bg-muted/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{selected.deposit_no}</span>
                  <Badge variant="outline">
                    {t("deposit.remaining")}: {selected.remaining_qty} {selected.unit_name}
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="pos-withdraw-qty">{t("deposit.withdrawQty")}</FieldLabel>
                    <Input
                      id="pos-withdraw-qty"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      disabled={withdrawing}
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
        </DialogContent>
      </Dialog>

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
