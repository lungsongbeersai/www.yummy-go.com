"use client";

import { useEffect, useMemo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Check, ChevronsUpDown, ClipboardList, Info, UserPlus, Wine } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { CustomerFormDialog } from "@/features/settings/customer/customer-form-dialog";
import { customerFormInput } from "@/features/settings/customer/customer-utils";
import {
  cartItemDisplayName,
  cartItemName,
  cartItemQty,
  cartItemUuid,
  isCanceledCartItem,
  optionalString
} from "@/features/pos/table-selection/utils";
import type { Customer } from "@/services/customer";
import type { CartItem } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useDepositStore } from "@/stores/deposit-store";
import { useToastStore } from "@/stores/toast-store";
import {
  expireDateFromToday,
  toDepositQtyInput,
  validateDepositCreate
} from "./deposit-utils";

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

interface DepositableItem {
  key: string;
  proDetailUuid: string;
  name: string;
  orderedQty: number;
}

function depositableItems(orderItems: CartItem[]): DepositableItem[] {
  const items: DepositableItem[] = [];
  for (const item of orderItems) {
    if (isCanceledCartItem(item)) continue;
    const proDetailUuid = optionalString(item.pro_detail_uuid, item.pro_detail_uuid_fk);
    const key = cartItemUuid(item) ?? proDetailUuid;
    if (!proDetailUuid || !key) continue;
    const sizeName = optionalString(item.detail?.size_name);
    items.push({
      key,
      proDetailUuid,
      name: cartItemDisplayName(cartItemName(item), sizeName),
      orderedQty: cartItemQty(item)
    });
  }
  return items;
}

function validationKey(error: string | null) {
  return error ? `deposit.validation.create${error.charAt(0).toUpperCase()}${error.slice(1)}` : "";
}

export function DepositCreateDialog({
  branchUuid,
  open,
  onOpenChange,
  orderItems
}: {
  branchUuid?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItems: CartItem[];
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const resolvedBranchUuid = branchUuid || user?.branch_uuid || "";

  const saving = useDepositStore((state) => state.saving);
  const createDepositAction = useDepositStore((state) => state.create);
  const showToast = useToastStore((state) => state.show);

  const customerRows = useCustomerStore((state) => state.rows);
  const customerLoading = useCustomerStore((state) => state.loading);
  const loadCustomers = useCustomerStore((state) => state.load);
  const saveCustomer = useCustomerStore((state) => state.save);

  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerUuid, setCustomerUuid] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [customerCreateSaving, setCustomerCreateSaving] = useState(false);

  const [selectedQty, setSelectedQty] = useState<Map<string, string>>(new Map());
  const [expireDate, setExpireDate] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const items = useMemo(() => depositableItems(orderItems), [orderItems]);

  const draftItems = useMemo(
    () =>
      items
        .filter((item) => selectedQty.has(item.key))
        .map((item) => ({
          ...item,
          qty: toDepositQtyInput(selectedQty.get(item.key))
        })),
    [items, selectedQty]
  );

  const validationError = validateDepositCreate({
    customerUuid,
    items: draftItems.map((item) => ({ proDetailUuid: item.proDetailUuid, qty: item.qty })),
    expireDate
  });

  // เปิด dialog นี้ใหม่ทุกครั้ง = เคลียร์ฟอร์ม + ตั้ง expire_date เริ่มต้นจาก
  // ค่ามาตรฐานของร้าน (ยังแก้ไขได้ ค่าจริงคำนวณซ้ำที่ backend เสมอ)
  useResetOnChange(open, () => {
    setCustomerUuid("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setSelectedQty(new Map());
    setExpireDate(expireDateFromToday(user?.deposit_expire_days));
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

  function toggleItem(item: DepositableItem, checked: boolean) {
    setSelectedQty((current) => {
      const next = new Map(current);
      if (checked) next.set(item.key, String(item.orderedQty));
      else next.delete(item.key);
      return next;
    });
  }

  function setItemQty(key: string, value: string) {
    setSelectedQty((current) => new Map(current).set(key, value));
  }

  function openCustomerCreate() {
    if (!storeUuid) return;
    setCustomerOpen(false);
    setCustomerCreateOpen(true);
  }

  async function submitCustomerCreate(formData: FormData) {
    if (!storeUuid) return;
    setCustomerCreateSaving(true);
    try {
      const saved = await saveCustomer(customerFormInput(formData, storeUuid, null));
      const uuid = customerUuidOf(saved);
      if (uuid) {
        setCustomerUuid(uuid);
        setSelectedCustomer(saved);
      }
      setCustomerCreateOpen(false);
      showToast({ title: t("settings.saved"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setCustomerCreateSaving(false);
    }
  }

  function requestConfirmation() {
    if (validationError) {
      showToast({ title: t(validationKey(validationError)), tone: "error" });
      return;
    }
    setConfirmOpen(true);
  }

  async function submitCreate() {
    if (validationError || saving) return;

    try {
      await createDepositAction({
        request_uuid: crypto.randomUUID(),
        branch_uuid: resolvedBranchUuid,
        customer_uuid: customerUuid,
        items: draftItems.map((item) => ({ pro_detail_uuid: item.proDetailUuid, deposit_qty: item.qty })),
        expire_date: expireDate || undefined,
        note: note.trim(),
        lang: language
      });
      setConfirmOpen(false);
      onOpenChange(false);
      showToast({ title: t("deposit.createSuccess"), tone: "success" });
    } catch (createError) {
      showToast({
        title: t("deposit.createFailed"),
        description: createError instanceof Error ? createError.message : "",
        tone: "error"
      });
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
        <DialogContent showCloseButton={!saving} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                <Wine className="size-4" aria-hidden />
              </span>
              {t("deposit.createTitle")}
            </DialogTitle>
            <DialogDescription>{t("deposit.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
              <Field>
                <FieldLegend className="flex items-center gap-2 text-sm">{t("deposit.customer")}</FieldLegend>
                <FieldDescription>{t("deposit.customerSectionHint")}</FieldDescription>
              </Field>
              <div className="flex gap-2">
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      disabled={saving}
                      className="min-w-0 flex-1 justify-between font-normal"
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
                              <CommandItem
                                key={uuid}
                                value={uuid}
                                onSelect={() => {
                                  setCustomerUuid(uuid);
                                  setSelectedCustomer(customer);
                                  setCustomerOpen(false);
                                }}
                              >
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={saving || !storeUuid}
                  aria-label={t("deposit.addCustomer")}
                  onClick={openCustomerCreate}
                >
                  <UserPlus />
                </Button>
              </div>
            </FieldSet>

            <FieldSet className="gap-3 rounded-lg border border-border bg-card p-4">
              <Field>
                <FieldLegend className="flex items-center gap-2 text-sm">
                  <ClipboardList className="size-4 text-primary" aria-hidden />
                  {t("deposit.itemsFromOrder")}
                </FieldLegend>
                <FieldDescription>{t("deposit.itemsFromOrderHint")}</FieldDescription>
              </Field>

              {items.length ? (
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const checked = selectedQty.has(item.key);
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-3 rounded-md border border-border bg-muted/25 px-3 py-2"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={saving}
                          onCheckedChange={(value) => toggleItem(item, value === true)}
                          aria-label={item.name}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("deposit.orderedQty", { qty: item.orderedQty })}
                          </p>
                        </div>
                        {checked ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            disabled={saving}
                            className="w-20 shrink-0"
                            value={selectedQty.get(item.key) ?? ""}
                            onChange={(event) => setItemQty(item.key, event.target.value)}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                  <Info className="size-4 shrink-0" aria-hidden />
                  {t("deposit.noOrderItems")}
                </div>
              )}
            </FieldSet>

            <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
              <Field>
                <FieldLegend className="text-sm">{t("deposit.timingAndNote")}</FieldLegend>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="pos-deposit-expire-date">{t("deposit.expireDate")}</FieldLabel>
                  <Input
                    id="pos-deposit-expire-date"
                    type="date"
                    disabled={saving}
                    value={expireDate}
                    onChange={(event) => setExpireDate(event.target.value)}
                  />
                  <FieldDescription>{t("deposit.expireDateHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pos-deposit-note">{t("deposit.note")}</FieldLabel>
                  <Textarea
                    id="pos-deposit-note"
                    disabled={saving}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("deposit.notePlaceholder")}
                  />
                </Field>
              </div>
            </FieldSet>

            {validationError ? (
              <p className="text-sm font-medium text-destructive">{t(validationKey(validationError))}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button type="button" disabled={saving || Boolean(validationError)} onClick={requestConfirmation}>
              {saving
                ? t("deposit.saving")
                : draftItems.length
                  ? t("deposit.createSubmitCount", { count: draftItems.length })
                  : t("deposit.createSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerFormDialog
        editing={null}
        open={customerCreateOpen}
        saving={customerCreateSaving}
        onOpenChange={setCustomerCreateOpen}
        onSubmit={submitCustomerCreate}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deposit.createConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deposit.createConfirmDescriptionMulti", {
                customer: selectedCustomer ? customerLabel(selectedCustomer) : "",
                count: draftItems.length
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1 text-sm">
            {draftItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{item.name}</span>
                <Badge variant="outline">{item.qty}</Badge>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t("actions.cancel")}</AlertDialogCancel>
            <Button disabled={saving} onClick={() => void submitCreate()}>
              {saving ? t("deposit.saving") : t("deposit.createSubmit")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
