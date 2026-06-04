"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  Check,
  ChevronsUpDown,
  Clock3,
  CreditCard,
  Landmark,
  Printer,
  ReceiptText,
} from "lucide-react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/format";
import { toApiLanguage, toLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { getBranchQrUrl } from "@/services/branch";
import {
  OrderChannelEnum,
  type CartOrder,
  type OrderChannel,
  type PaymentResponse,
  type PosTable,
  type SplitBillResponse,
} from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useExchangeStore } from "@/stores/exchange-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { usePaymentCustomers } from "./hooks/use-payment-customers";
import { PaymentStat, PosNumpad, TenderRow } from "./payment-dialog-components";
import { cartOrderInvoice, cartSummary, optionalString } from "./utils";
import {
  activeAmountField,
  activeExactAmountLak,
  amountInput,
  buildInvoicePrintData,
  currencyAllowsDecimal,
  currencyMoney,
  currencyOptionLabel,
  customerLabel,
  customerMeta,
  customerUuidOf,
  defaultCurrencyInput,
  displayCaretFromRawCaret,
  exchangeCurrencyOptions,
  firstOrderUuid,
  formatAmountInputDisplay,
  formatCurrencyInput,
  getPrintInvoiceJob,
  getPrintableJob,
  LAK_CURRENCY_OPTION,
  LAK_CURRENCY_VALUE,
  openLocalInvoicePrintWindow,
  orderChannelOptions,
  parseAmount,
  paymentAmounts,
  paymentNote,
  paymentTabs,
  paymentValidation,
  quickCashAmounts,
  rawCaretFromDisplayCaret,
  shouldIgnoreKeypadTarget,
  tenderInputLak,
  tenderInputValue,
  tenderLabel,
  type InvoicePrintData,
  type PaymentKind,
  type PaymentTab,
  type SplitTenderField,
  type TenderField,
} from "./payment-dialog-utils";

export interface PaymentDialogProps {
  onCompleted: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orders: CartOrder[];
  paymentKind?: PaymentKind;
  splitBillItemUuids?: string[];
  summary: ReturnType<typeof cartSummary>;
  table: PosTable;
}

export function PaymentDialog({
  onCompleted,
  onOpenChange,
  open,
  orders,
  paymentKind = "full",
  splitBillItemUuids = [],
  summary,
  table,
}: PaymentDialogProps) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const exchanges = useExchangeStore((state) => state.allRows);
  const loadExchangeRates = useExchangeStore((state) => state.loadAll);
  const exchangeRatesLoading = useExchangeStore((state) => state.loadingAll);
  const createPayment = usePosStore((state) => state.createPayment);
  const splitBill = usePosStore((state) => state.splitBill);
  const printInvoice = usePosStore((state) => state.printInvoice);
  const print = usePrinterStore((state) => state.print);
  const showToast = useToastStore((state) => state.show);
  const activeAmountInputRef = useRef<HTMLInputElement>(null);
  const {
    customerOpen,
    customerOptions,
    customerSearch,
    customerSearchLoading,
    customerUuid,
    handleCustomerOpenChange,
    handleCustomerSelect,
    selectedCustomerOption,
    setCustomerSearch,
  } = usePaymentCustomers({ language, open, user });
  const [activeTab, setActiveTab] = useState<PaymentTab>("cash");
  const [activeSplitField, setActiveSplitField] =
    useState<SplitTenderField>("cash");
  const [cashInput, setCashInput] = useState("");
  const [splitCashInput, setSplitCashInput] = useState("");
  const [splitTransferInput, setSplitTransferInput] = useState("");
  const [orderChannel, setOrderChannel] = useState<OrderChannel>(
    OrderChannelEnum.DINE_IN,
  );
  const [currencyValue, setCurrencyValue] = useState(LAK_CURRENCY_VALUE);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [invoicePrinting, setInvoicePrinting] = useState(false);
  const isSplitPayment = paymentKind === "split";
  const totalAmount = Math.max(0, Number(summary.grandTotal ?? 0));
  const invoice = cartOrderInvoice(orders);
  const branchQr = optionalString(...orders.map((order) => order.branch_qr));
  const branchQrUrl = branchQr ? getBranchQrUrl(branchQr) : null;
  const orderUuid = firstOrderUuid(orders);
  const currencyOptions = useMemo(
    () => exchangeCurrencyOptions(exchanges),
    [exchanges],
  );
  const selectedCurrency =
    currencyOptions.find((option) => option.value === currencyValue) ??
    LAK_CURRENCY_OPTION;
  const allowDecimalAmount = currencyAllowsDecimal(selectedCurrency);
  const activeTenderField = activeAmountField(activeTab, activeSplitField);
  const payment = useMemo(
    () =>
      paymentAmounts(
        activeTab,
        totalAmount,
        cashInput,
        splitCashInput,
        splitTransferInput,
        selectedCurrency.rate,
      ),
    [
      activeTab,
      cashInput,
      selectedCurrency.rate,
      splitCashInput,
      splitTransferInput,
      totalAmount,
    ],
  );
  const activeExactAmount = activeTenderField
    ? activeExactAmountLak(activeTenderField, totalAmount, payment)
    : totalAmount;
  const quickAmounts = useMemo(
    () => quickCashAmounts(activeExactAmount, selectedCurrency),
    [activeExactAmount, selectedCurrency],
  );
  const validation = paymentValidation(
    activeTab,
    orderUuid,
    totalAmount,
    payment,
    customerUuid,
    isSplitPayment ? splitBillItemUuids : undefined,
  );
  const hasPrintableSplitItems =
    !isSplitPayment || splitBillItemUuids.length > 0;
  const canPrintInvoice =
    Boolean(orderUuid && user?.uuid) &&
    hasPrintableSplitItems &&
    !processing &&
    !invoicePrinting;
  const selectedTab =
    paymentTabs.find((tab) => tab.value === activeTab) ?? paymentTabs[0];
  const activeInputValue = activeTenderField
    ? tenderInputValue(
        activeTenderField,
        cashInput,
        splitCashInput,
        splitTransferInput,
      )
    : "";
  const activeInputDisplayValue = formatAmountInputDisplay(
    activeInputValue,
    selectedCurrency,
  );
  const activeInputLak = activeTenderField
    ? tenderInputLak(activeTenderField, payment)
    : 0;
  const activeTenderLabel = activeTenderField
    ? tenderLabel(activeTenderField, activeTab, t)
    : "";
  const currencyDescription = exchangeRatesLoading
    ? t("common.loading")
    : selectedCurrency.base && currencyOptions.length === 1
      ? t("pos.exchangeRateUnavailable")
      : t("pos.exchangeRate", {
          amount: money(selectedCurrency.rate),
          currency: selectedCurrency.code,
        });

  useEffect(() => {
    if (!open) return;
    const defaultAmount = defaultCurrencyInput(
      totalAmount,
      LAK_CURRENCY_OPTION,
    );
    setActiveTab("cash");
    setActiveSplitField("cash");
    setCashInput(defaultAmount);
    setSplitCashInput("");
    setSplitTransferInput(defaultAmount);
    setOrderChannel(OrderChannelEnum.DINE_IN);
    setCurrencyValue(LAK_CURRENCY_VALUE);
    setDueDate("");
    setNote("");
    setConfirmOpen(false);
    const storeUuid = authStoreUuid(user);
    if (storeUuid) {
      void loadExchangeRates({
        store_uuid_fk: storeUuid,
        lang: toApiLanguage(language),
      }).catch(() => undefined);
    }
  }, [isSplitPayment, language, loadExchangeRates, open, totalAmount, user]);

  useEffect(() => {
    if (!currencyOptions.some((option) => option.value === currencyValue))
      setCurrencyValue(LAK_CURRENCY_VALUE);
  }, [currencyOptions, currencyValue]);

  useEffect(() => {
    if (!open || !activeTenderField || activeTab === "arrears") return;
    const timer = window.setTimeout(() => {
      activeAmountInputRef.current?.focus();
      activeAmountInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeTab, activeTenderField, activeSplitField, open]);

  function handleCurrencyChange(value: string) {
    const option =
      currencyOptions.find((item) => item.value === value) ??
      LAK_CURRENCY_OPTION;
    const defaultAmount = defaultCurrencyInput(totalAmount, option);
    setCurrencyValue(option.value);
    setCashInput(defaultAmount);
    setSplitCashInput("");
    setSplitTransferInput(defaultAmount);
  }

  function handlePaymentTabChange(value: string) {
    const nextTab = value as PaymentTab;
    setActiveTab(nextTab);
    if (nextTab === "cash_transfer") {
      setActiveSplitField("cash");
      if (
        !splitCashInput &&
        splitTransferInput ===
          defaultCurrencyInput(totalAmount, selectedCurrency)
      )
        setSplitTransferInput("");
    }
  }

  function setTenderFieldInput(field: TenderField | null, value: string) {
    if (!field) return "";
    const nextValue = amountInput(value, allowDecimalAmount);
    if (field === "cash") setCashInput(nextValue);
    if (field === "split_cash") setSplitCashInput(nextValue);
    if (field === "split_transfer") setSplitTransferInput(nextValue);
    return nextValue;
  }

  function focusActiveAmount(caret?: number) {
    window.requestAnimationFrame(() => {
      const input = activeAmountInputRef.current;
      if (!input) return;
      input.focus();
      if (typeof caret === "number") input.setSelectionRange(caret, caret);
    });
  }

  function replaceActiveAmount(value: string, caret?: number) {
    if (!activeTenderField) return;
    const nextValue = amountInput(value, allowDecimalAmount);
    setTenderFieldInput(activeTenderField, nextValue);
    const rawCaret =
      typeof caret === "number"
        ? Math.min(caret, nextValue.length)
        : nextValue.length;
    focusActiveAmount(
      displayCaretFromRawCaret(nextValue, rawCaret, selectedCurrency),
    );
  }

  function handleActiveAmountChange(event: ChangeEvent<HTMLInputElement>) {
    if (!activeTenderField) return;
    const displayValue = event.target.value;
    const displayCaret = event.target.selectionStart ?? displayValue.length;
    const rawCaret = rawCaretFromDisplayCaret(
      displayValue,
      displayCaret,
      allowDecimalAmount,
    );
    const nextValue = setTenderFieldInput(activeTenderField, displayValue);
    focusActiveAmount(
      displayCaretFromRawCaret(nextValue, rawCaret, selectedCurrency),
    );
  }

  function insertKeypadValue(value: string) {
    if (!activeTenderField || activeTab === "arrears") return;
    const input = activeAmountInputRef.current;
    const currentValue = activeInputValue;
    const displayStart =
      input?.selectionStart ?? activeInputDisplayValue.length;
    const displayEnd = input?.selectionEnd ?? activeInputDisplayValue.length;
    const start = rawCaretFromDisplayCaret(
      activeInputDisplayValue,
      displayStart,
      allowDecimalAmount,
    );
    const end = rawCaretFromDisplayCaret(
      activeInputDisplayValue,
      displayEnd,
      allowDecimalAmount,
    );
    const nextValue = `${currentValue.slice(0, start)}${value}${currentValue.slice(end)}`;
    replaceActiveAmount(nextValue, start + value.length);
  }

  function insertDecimal() {
    if (!allowDecimalAmount || !activeTenderField || activeTab === "arrears")
      return;
    const input = activeAmountInputRef.current;
    const currentValue = activeInputValue;
    const displayStart =
      input?.selectionStart ?? activeInputDisplayValue.length;
    const displayEnd = input?.selectionEnd ?? activeInputDisplayValue.length;
    const start = rawCaretFromDisplayCaret(
      activeInputDisplayValue,
      displayStart,
      allowDecimalAmount,
    );
    const end = rawCaretFromDisplayCaret(
      activeInputDisplayValue,
      displayEnd,
      allowDecimalAmount,
    );
    const selectedText = currentValue.slice(start, end);
    if (currentValue.includes(".") && !selectedText.includes("."))
      return focusActiveAmount(
        displayCaretFromRawCaret(currentValue, start, selectedCurrency),
      );
    const nextValue = currentValue
      ? `${currentValue.slice(0, start)}.${currentValue.slice(end)}`
      : "0.";
    replaceActiveAmount(nextValue, currentValue ? start + 1 : 2);
  }

  function backspaceActiveAmount() {
    if (!activeTenderField || activeTab === "arrears") return;
    const input = activeAmountInputRef.current;
    const currentValue = activeInputValue;
    const displayStart =
      input?.selectionStart ?? activeInputDisplayValue.length;
    const displayEnd = input?.selectionEnd ?? activeInputDisplayValue.length;
    const start = rawCaretFromDisplayCaret(
      activeInputDisplayValue,
      displayStart,
      allowDecimalAmount,
    );
    const end = rawCaretFromDisplayCaret(
      activeInputDisplayValue,
      displayEnd,
      allowDecimalAmount,
    );
    if (start !== end)
      return replaceActiveAmount(
        `${currentValue.slice(0, start)}${currentValue.slice(end)}`,
        start,
      );
    if (start <= 0) return focusActiveAmount(0);
    replaceActiveAmount(
      `${currentValue.slice(0, start - 1)}${currentValue.slice(end)}`,
      start - 1,
    );
  }

  function clearActiveAmount() {
    replaceActiveAmount("", 0);
  }

  function exactActiveAmount() {
    if (!activeTenderField || activeTab === "arrears") return;
    const exactValue = defaultCurrencyInput(
      activeExactAmount,
      selectedCurrency,
    );
    replaceActiveAmount(exactValue, exactValue.length);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      processing ||
      confirmOpen ||
      customerOpen ||
      activeTab === "arrears" ||
      !activeTenderField
    )
      return;

    const target = event.target as HTMLElement | null;
    if (
      target &&
      shouldIgnoreKeypadTarget(target, activeAmountInputRef.current)
    ) {
      if (target === activeAmountInputRef.current && event.key === "Enter") {
        event.preventDefault();
        requestSubmit();
      }
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      insertKeypadValue(event.key);
    } else if (event.key === "." || event.key === ",") {
      event.preventDefault();
      insertDecimal();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      backspaceActiveAmount();
    } else if (event.key === "Delete" || event.key.toLowerCase() === "c") {
      event.preventDefault();
      clearActiveAmount();
    } else if (event.key === "Enter") {
      event.preventDefault();
      requestSubmit();
    }
  }

  function requestSubmit() {
    if (validation || processing) return;
    setConfirmOpen(true);
  }

  async function submitPayment() {
    if (validation || processing || !user?.uuid) return;

    setProcessing(true);
    try {
      const paymentPayload = {
        order_uuid: orderUuid,
        customer_uuid_fk: customerUuid,
        payment_method: selectedTab.method,
        amount: totalAmount,
        cash_payment_amount: payment.cash,
        transfer_payment_amount: payment.transfer,
        change_amount: payment.change,
        due_date: activeTab === "arrears" ? dueDate || undefined : undefined,
        note: paymentNote(activeTab, note),
        login_uuid_fk: user.uuid,
      };
      const response = isSplitPayment
        ? await splitBill({
            ...paymentPayload,
            order_item_uuids: splitBillItemUuids,
            order_channel: orderChannel,
            lang: toLanguage(language),
          })
        : await createPayment({
            ...paymentPayload,
            order_channel: orderChannel,
            paid_at: null,
            lang: toApiLanguage(language),
          });

      await printReceipt(response);
      showToast({
        title: t(
          isSplitPayment ? "pos.splitPaymentCreated" : "pos.paymentSuccess",
        ),
        tone: "success",
      });
      onOpenChange(false);
      await onCompleted();
    } catch (error) {
      showToast({
        title: t(
          isSplitPayment ? "pos.splitPaymentFailed" : "pos.paymentFailed",
        ),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setProcessing(false);
      setConfirmOpen(false);
    }
  }

  async function printReceipt(response: PaymentResponse | SplitBillResponse) {
    const job = getPrintableJob(response.print_job);
    if (!job) return;

    try {
      await print(job);
    } catch (error) {
      showToast({
        title: t("pos.receiptPrintFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "info",
      });
    }
  }

  async function handlePrintInvoice() {
    if (!orderUuid || !user?.uuid || processing || invoicePrinting) return;

    const invoicePrintData = buildInvoicePrintData({
      invoice,
      orders,
      qrUrl: branchQrUrl,
      selectedCustomer: selectedCustomerOption,
      summary,
      table,
      translate: (key, options) => String(t(key, options)),
      user,
    });

    setInvoicePrinting(true);
    try {
      const response = await printInvoice({
        order_uuid: orderUuid,
        ...(isSplitPayment ? { order_item_uuids: splitBillItemUuids } : {}),
        lang: toApiLanguage(language),
        login_uuid_fk: user.uuid,
      });
      const job = getPrintInvoiceJob(response);

      if (!job) {
        await showInvoicePrintFallback(
          invoicePrintData,
          t("pos.invoicePrintMissingJob"),
        );
        return;
      }

      try {
        await print(job);
        showToast({ title: t("pos.invoicePrintSent"), tone: "success" });
      } catch (error) {
        await showInvoicePrintFallback(
          invoicePrintData,
          error instanceof Error ? error.message : "",
        );
      }
    } catch (error) {
      await showInvoicePrintFallback(
        invoicePrintData,
        error instanceof Error ? error.message : "",
      );
    } finally {
      setInvoicePrinting(false);
    }
  }

  async function showInvoicePrintFallback(
    data: InvoicePrintData,
    description: string,
  ) {
    const opened = await openLocalInvoicePrintWindow(data);
    if (opened) {
      showToast({
        title: t("pos.invoicePrintFallback"),
        description,
        tone: "info",
      });
      return;
    }

    showToast({
      title: t("pos.invoicePrintFailed"),
      description: t("pos.invoicePrintPopupBlocked"),
      tone: "error",
    });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => !processing && onOpenChange(nextOpen)}
      >
        <DialogContent
          className="grid h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)] sm:max-w-[calc(100vw-1rem)] sm:rounded-lg sm:border xl:max-w-[1280px]"
          onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="shrink-0 border-b border-border bg-card px-3 py-1.5 pr-12 text-left sm:px-4 sm:py-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="flex min-w-0 items-center gap-2 text-base font-black sm:text-xl">
                  <CreditCard />
                  <span className="truncate">
                    {isSplitPayment
                      ? t("pos.splitPayment")
                      : t("pos.paymentTitle")}
                  </span>
                </DialogTitle>
                <DialogDescription className="mt-0.5 truncate text-xs sm:text-sm">
                  {t("nav.table")}: {table.table_name}
                  {invoice ? ` - ${t("pos.invoice")}: ${invoice}` : ""}
                  {isSplitPayment ? ` - ${t("pos.splitPayment")}` : ""}
                </DialogDescription>
              </div>
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                {isSplitPayment ? (
                  <Badge className="rounded-full px-3 py-1 font-black">
                    {t("pos.splitPayment")}
                  </Badge>
                ) : null}
                <Badge className="rounded-full px-3 py-1 font-black tabular-nums">
                  {selectedCurrency.code}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-muted/30 md:grid-cols-[280px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:grid-rows-1 xl:grid-cols-[320px_minmax(0,1fr)_360px]"
            onValueChange={handlePaymentTabChange}
          >
            <aside
              className="min-h-0 border-b border-border bg-background p-1.5 sm:p-3 md:border-b-0 md:border-r lg:p-4"
              data-pos-keypad-ignore="true"
            >
              <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1.5 md:gap-3">
                <TabsList className="grid h-auto grid-cols-4 gap-1 rounded-lg bg-muted p-1 md:grid-cols-2 md:gap-1.5 md:p-1.5">
                  {paymentTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        aria-label={t(tab.labelKey)}
                        className="h-9 min-w-0 gap-2 rounded-md px-2 font-black min-[430px]:h-10 md:h-11"
                      >
                        <Icon />
                        <span className="hidden truncate min-[430px]:inline md:inline">
                          {t(tab.labelKey)}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <div className="min-h-0 overflow-hidden">
                  <FieldGroup className="grid grid-cols-2 gap-1.5 md:grid-cols-1 md:gap-3">
                    <Field
                      className="col-span-2 gap-1 md:col-span-1 md:gap-1.5"
                      data-invalid={!customerUuid}
                    >
                      <FieldLabel className="sr-only min-[430px]:not-sr-only min-[430px]:truncate">
                        {t("pos.customer")}
                      </FieldLabel>
                      <Popover
                        open={customerOpen}
                        onOpenChange={handleCustomerOpenChange}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            aria-busy={customerSearchLoading}
                            aria-expanded={customerOpen}
                            aria-haspopup="listbox"
                            aria-invalid={!customerUuid}
                            className={cn(
                              "h-9 w-full justify-between min-[430px]:h-10 md:h-11",
                              !customerUuid && "border-destructive/60",
                            )}
                            role="combobox"
                            type="button"
                            variant="outline"
                          >
                            <span
                              className={cn(
                                "min-w-0 truncate",
                                !selectedCustomerOption &&
                                  "text-muted-foreground",
                              )}
                            >
                              {selectedCustomerOption
                                ? customerLabel(selectedCustomerOption)
                                : t("pos.selectCustomer")}
                            </span>
                            {customerSearchLoading ? (
                              <Spinner data-icon="inline-end" />
                            ) : (
                              <ChevronsUpDown
                                className="opacity-50"
                                data-icon="inline-end"
                              />
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-[min(var(--radix-popover-trigger-width),calc(100vw-1rem))] overflow-hidden p-0"
                          side="bottom"
                          sideOffset={6}
                          onTouchMove={(event) => event.stopPropagation()}
                          onWheel={(event) => event.stopPropagation()}
                        >
                          <Command
                            className="[&_[data-slot=command-input-wrapper]]:h-9 [&_[data-slot=command-input]]:h-9 [&_[data-slot=command-item]]:py-2"
                            shouldFilter={false}
                          >
                            <CommandInput
                              placeholder={t("pos.searchCustomer")}
                              value={customerSearch}
                              onValueChange={setCustomerSearch}
                            />
                            <CommandList className="max-h-56 overscroll-contain">
                              <CommandEmpty>
                                {customerSearchLoading
                                  ? t("common.loading")
                                  : t("pos.noCustomerResults")}
                              </CommandEmpty>
                              <CommandGroup>
                                {customerOptions.map((customer) => {
                                  const uuid = customerUuidOf(customer);
                                  if (!uuid) return null;
                                  const meta = customerMeta(customer);

                                  return (
                                    <CommandItem
                                      key={uuid}
                                      value={uuid}
                                      onSelect={() =>
                                        handleCustomerSelect(customer)
                                      }
                                    >
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold">
                                          {customerLabel(customer)}
                                        </span>
                                        {meta ? (
                                          <span className="block truncate text-xs text-muted-foreground">
                                            {meta}
                                          </span>
                                        ) : null}
                                      </span>
                                      <Check
                                        className={
                                          uuid === customerUuid
                                            ? "ml-auto opacity-100"
                                            : "ml-auto opacity-0"
                                        }
                                      />
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </Field>

                    <Field className="gap-1 md:gap-1.5">
                      <FieldLabel className="sr-only min-[430px]:not-sr-only min-[430px]:truncate">
                        {t("pos.orderChannel")}
                      </FieldLabel>
                      <Select
                        value={String(orderChannel)}
                        onValueChange={(value) =>
                          setOrderChannel(Number(value) as OrderChannel)
                        }
                      >
                        <SelectTrigger className="h-9 w-full min-[430px]:h-10 md:h-11">
                          <SelectValue placeholder={t("pos.orderChannel")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {orderChannelOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={String(option.value)}
                              >
                                {t(option.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field className="gap-1 md:gap-1.5">
                      <FieldLabel className="sr-only min-[430px]:not-sr-only min-[430px]:truncate">
                        {t("pos.paymentCurrency")}
                      </FieldLabel>
                      <Select
                        value={selectedCurrency.value}
                        onValueChange={handleCurrencyChange}
                      >
                        <SelectTrigger className="h-9 w-full min-[430px]:h-10 md:h-11">
                          <SelectValue placeholder={t("pos.paymentCurrency")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {currencyOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {currencyOptionLabel(option)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription className="hidden text-xs md:block">
                        {currencyDescription}
                      </FieldDescription>
                    </Field>
                  </FieldGroup>

                  <Separator className="my-3 hidden md:block" />
                  <div className="hidden rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground md:grid md:gap-1">
                    <span className="truncate font-semibold text-foreground">
                      {t("nav.table")}: {table.table_name}
                    </span>
                    {invoice ? (
                      <span className="truncate">
                        {t("pos.invoice")}: {invoice}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </aside>

            <section className="min-h-0 overflow-hidden p-1.5 sm:p-3 lg:p-4">
              <div className="h-full min-h-0">
                {activeTenderField ? (
                  <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-1.5 sm:gap-3">
                    <div className="rounded-lg border border-border bg-card p-2 sm:p-3 lg:p-4">
                      <Field className="gap-1 min-[430px]:gap-1.5">
                        <FieldLabel htmlFor="payment-active-amount">
                          {activeTenderLabel} ({selectedCurrency.code})
                        </FieldLabel>
                        <Input
                          ref={activeAmountInputRef}
                          id="payment-active-amount"
                          inputMode={allowDecimalAmount ? "decimal" : "numeric"}
                          value={activeInputDisplayValue}
                          className="h-10 text-right text-2xl font-black tabular-nums min-[430px]:h-12 sm:h-14 sm:text-3xl lg:h-16 xl:text-4xl"
                          onChange={handleActiveAmountChange}
                        />
                        <FieldDescription className="hidden text-xs min-[430px]:block sm:text-sm">
                          {t("pos.equivalentLak")}: {money(activeInputLak)}
                        </FieldDescription>
                      </Field>

                      {activeTab === "cash_transfer" ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <TenderRow
                            active={activeSplitField === "cash"}
                            label={t("pos.cashAmount")}
                            value={currencyMoney(
                              parseAmount(splitCashInput),
                              selectedCurrency,
                            )}
                            equivalent={money(payment.cash)}
                            onSelect={() => setActiveSplitField("cash")}
                          />
                          <TenderRow
                            active={activeSplitField === "transfer"}
                            label={t("pos.transferAmount")}
                            value={currencyMoney(
                              parseAmount(splitTransferInput),
                              selectedCurrency,
                            )}
                            equivalent={money(payment.transfer)}
                            onSelect={() => setActiveSplitField("transfer")}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 min-[430px]:gap-2">
                      {quickAmounts.map((amount) => (
                        <Button
                          key={amount}
                          type="button"
                          variant="outline"
                          className="h-9 min-w-0 px-2 font-black tabular-nums min-[430px]:h-10 sm:h-11 lg:h-12"
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => {
                            const value = formatCurrencyInput(
                              amount,
                              selectedCurrency,
                            );
                            replaceActiveAmount(value, value.length);
                          }}
                        >
                          <span className="truncate text-xs min-[430px]:text-sm">
                            {currencyMoney(amount, selectedCurrency)}
                          </span>
                        </Button>
                      ))}
                    </div>

                    <PosNumpad
                      allowDecimal={allowDecimalAmount}
                      clearLabel={t("pos.clearAmount")}
                      confirmLabel={t("pos.numpadConfirm")}
                      exactLabel={t("pos.exactAmount")}
                      backspaceLabel={t("pos.backspaceAmount")}
                      onBackspace={backspaceActiveAmount}
                      onClear={clearActiveAmount}
                      onConfirm={requestSubmit}
                      onDecimal={insertDecimal}
                      onDigit={insertKeypadValue}
                      onExact={exactActiveAmount}
                      processing={processing}
                    />
                  </div>
                ) : activeTab === "transfer" ? (
                  <div className="grid h-full min-h-0 place-items-center rounded-lg border border-border bg-card p-3 sm:p-4">
                    <div className="grid w-full max-w-[520px] gap-3">
                      <div className="grid min-h-0 place-items-center rounded-lg border border-border bg-muted/30 p-3">
                        {branchQrUrl ? (
                          <Image
                            alt={t("pos.branchQr")}
                            className="aspect-square max-h-[min(42dvh,18rem)] w-full max-w-[min(42dvh,18rem)] rounded-md bg-background object-contain p-3 shadow-sm"
                            height={288}
                            src={branchQrUrl}
                            unoptimized
                            width={288}
                          />
                        ) : (
                          <Landmark className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex justify-center">
                        <Badge className="rounded-full px-3 py-1 font-black">
                          {t("pos.paymentTransfer")}
                        </Badge>
                      </div>
                      {branchQrUrl ? (
                        <p className="text-center text-sm text-muted-foreground">
                          {t("pos.transferPaymentHint")}
                        </p>
                      ) : (
                        <p className="text-center text-sm font-semibold text-muted-foreground">
                          {t("pos.noBranchQr")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid h-full min-h-0 rounded-lg border border-border bg-card p-3 sm:p-4">
                    <div className="grid min-h-0 content-start gap-3">
                      <div className="flex items-center gap-2">
                        <Clock3 />
                        <Badge className="rounded-full px-3 py-1 font-black">
                          {t("pos.paymentArrears")}
                        </Badge>
                      </div>
                      <FieldGroup className="grid gap-3">
                        <Field className="gap-1.5">
                          <FieldLabel htmlFor="payment-due-date">
                            {t("pos.dueDate")}
                          </FieldLabel>
                          <Input
                            id="payment-due-date"
                            className="h-11"
                            type="date"
                            value={dueDate}
                            onChange={(event) => setDueDate(event.target.value)}
                          />
                        </Field>
                        <Field className="gap-1.5">
                          <FieldLabel htmlFor="payment-note">
                            {t("pos.note")}
                          </FieldLabel>
                          <Textarea
                            id="payment-note"
                            className="min-h-24 resize-none lg:min-h-32"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder={t("pos.paymentNotePlaceholder")}
                          />
                        </Field>
                      </FieldGroup>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <aside
              className="min-h-0 border-t border-border bg-background p-1.5 sm:p-3 md:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0 lg:p-4"
              data-pos-keypad-ignore="true"
            >
              <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1.5 md:grid-cols-[minmax(0,1fr)_auto] md:grid-rows-1 lg:grid-cols-1 lg:grid-rows-[minmax(0,1fr)_auto]">
                <div className="grid min-h-0 grid-cols-3 gap-1.5 lg:grid-cols-1 lg:content-start lg:gap-3">
                  <div className="hidden rounded-lg border border-border bg-muted/30 p-3 lg:grid lg:gap-1">
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      {t("nav.table")}
                    </p>
                    <p className="truncate text-base font-black">
                      {table.table_name}
                    </p>
                    {invoice ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {t("pos.invoice")}: {invoice}
                      </p>
                    ) : null}
                  </div>
                  <PaymentStat
                    label={t("pos.amountDue")}
                    value={money(totalAmount)}
                    hero
                  />
                  <PaymentStat
                    label={t("pos.amountReceived")}
                    value={money(payment.received)}
                  />
                  <PaymentStat
                    label={
                      payment.balance > 0
                        ? t("pos.remainingAmount")
                        : t("pos.changeAmount")
                    }
                    value={money(
                      payment.balance > 0 ? payment.balance : payment.change,
                    )}
                    strong
                  />
                </div>

                <div className="grid content-end gap-1.5 md:w-[260px] lg:w-auto">
                  {validation ? (
                    <p
                      role="alert"
                      className="min-h-5 text-sm font-semibold text-destructive"
                    >
                      {t(validation)}
                    </p>
                  ) : (
                    <p className="min-h-5 text-sm font-semibold text-muted-foreground">
                      {selectedTab
                        ? t(selectedTab.labelKey)
                        : t("pos.paymentTitle")}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 font-black sm:h-12"
                    disabled={!canPrintInvoice}
                    onClick={() => void handlePrintInvoice()}
                  >
                    {invoicePrinting ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Printer data-icon="inline-start" />
                    )}
                    {t("pos.printInvoice")}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 sm:h-12"
                      disabled={processing}
                      onClick={() => onOpenChange(false)}
                    >
                      {t("actions.cancel")}
                    </Button>
                    <Button
                      type="button"
                      className="h-10 font-black sm:h-12"
                      disabled={Boolean(validation) || processing}
                      onClick={requestSubmit}
                    >
                      {processing ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <ReceiptText data-icon="inline-start" />
                      )}
                      {t("pos.confirmPayment")}
                    </Button>
                  </div>
                </div>
              </div>
            </aside>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(nextOpen) => !processing && setConfirmOpen(nextOpen)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pos.confirmPayment")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pos.confirmPaymentDescription", {
                amount: money(totalAmount),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={processing}
              onClick={() => void submitPayment()}
            >
              {processing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Printer data-icon="inline-start" />
              )}
              {t("pos.confirmPayment")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
