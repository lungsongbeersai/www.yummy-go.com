"use client";

import { useEffect, useMemo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Check, ChevronsUpDown, Wine } from "lucide-react";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/services/customer";
import type { Product, ProductDetail } from "@/services/product";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useDepositStore } from "@/stores/deposit-store";
import { useProductStore } from "@/stores/product-store";
import { useToastStore } from "@/stores/toast-store";
import { toDepositQtyInput, validateDepositCreate } from "./deposit-utils";

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

function validationKey(error: string | null) {
  return error ? `deposit.validation.create${error.charAt(0).toUpperCase()}${error.slice(1)}` : "";
}

export function DepositCreateDialog({
  branchUuid,
  open,
  onOpenChange
}: {
  branchUuid?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const isEng = language === "en";
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const resolvedBranchUuid = branchUuid || user?.branch_uuid || "";

  const saving = useDepositStore((state) => state.saving);
  const createDepositAction = useDepositStore((state) => state.create);
  const showToast = useToastStore((state) => state.show);

  const customerRows = useCustomerStore((state) => state.rows);
  const customerLoading = useCustomerStore((state) => state.loading);
  const loadCustomers = useCustomerStore((state) => state.load);

  const productRows = useProductStore((state) => state.rows);
  const productLoading = useProductStore((state) => state.loading);
  const loadProducts = useProductStore((state) => state.load);

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const depositQty = toDepositQtyInput(depositQtyInput);
  const validationError = validateDepositCreate({ customerUuid, proDetailUuid, depositQty, expireDate });
  const productOptions = useMemo(() => productDetailOptions(productRows, isEng), [productRows, isEng]);

  // เปิด/ปิด dialog นี้ใหม่ = ล้างฟอร์มให้พร้อมสำหรับรอบถัดไป
  useResetOnChange(open, () => {
    setCustomerUuid("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setProDetailUuid("");
    setSelectedProductOption(null);
    setProductSearch("");
    setDepositQtyInput("1");
    setExpireDate("");
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

  useEffect(() => {
    if (!resolvedBranchUuid || !productOpen) return;
    const query = productSearch.trim();
    const timer = window.setTimeout(() => {
      void loadProducts({ branch_uuid_fk: resolvedBranchUuid, search: query, limit: PICKER_LIMIT, lang: language });
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [language, loadProducts, productOpen, productSearch, resolvedBranchUuid]);

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
        pro_detail_uuid: proDetailUuid,
        deposit_qty: depositQty,
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
        <DialogContent showCloseButton={!saving} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wine className="size-4 text-primary" />
              {t("deposit.createTitle")}
            </DialogTitle>
            <DialogDescription>{t("deposit.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel>{t("deposit.customer")}</FieldLabel>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    disabled={saving}
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
                    disabled={saving || !resolvedBranchUuid}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {selectedProductOption ? productDetailOptionLabel(selectedProductOption) : t("deposit.selectProduct")}
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
                            onSelect={() => {
                              setProDetailUuid(option.key);
                              setSelectedProductOption(option);
                              setProductOpen(false);
                            }}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pos-deposit-qty">{t("deposit.qty")}</FieldLabel>
                <Input
                  id="pos-deposit-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  disabled={saving}
                  value={depositQtyInput}
                  onChange={(event) => setDepositQtyInput(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pos-deposit-expire-date">{t("deposit.expireDate")}</FieldLabel>
                <Input
                  id="pos-deposit-expire-date"
                  type="date"
                  disabled={saving}
                  value={expireDate}
                  onChange={(event) => setExpireDate(event.target.value)}
                />
              </Field>
            </div>
            <FieldDescription>{t("deposit.expireDateHelp")}</FieldDescription>

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

            {validationError ? (
              <p className="text-sm font-medium text-destructive">{t(validationKey(validationError))}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button type="button" disabled={saving || Boolean(validationError)} onClick={requestConfirmation}>
              {saving ? t("deposit.saving") : t("deposit.createSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
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
    </>
  );
}
