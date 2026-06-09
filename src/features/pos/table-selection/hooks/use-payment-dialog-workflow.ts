"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { money } from "@/lib/format";
import { toApiLanguage, toLanguage } from "@/lib/language";
import { getBranchQrUrl } from "@/services/branch";
import {
  OrderChannelEnum,
  type OrderChannel,
  type PaymentResponse,
  type SplitBillResponse,
} from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useExchangeStore } from "@/stores/exchange-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { usePaymentCustomers } from "./use-payment-customers";
import type { PaymentDialogProps } from "../payment-dialog-types";
import { cartOrderInvoice, optionalString } from "../utils";
import {
  activeAmountField,
  activeExactAmountLak,
  amountInput,
  buildInvoicePrintData,
  currencyAllowsDecimal,
  defaultCurrencyInput,
  displayCaretFromRawCaret,
  exchangeCurrencyOptions,
  firstOrderUuid,
  formatAmountInputDisplay,
  getPrintInvoiceJob,
  getPrintableJob,
  LAK_CURRENCY_OPTION,
  LAK_CURRENCY_VALUE,
  openLocalInvoicePrintWindow,
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
  type PaymentTab,
  type SplitTenderField,
  type TenderField,
} from "../payment-dialog-utils";

export function usePaymentDialogWorkflow({
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
  const customers = usePaymentCustomers({ language, open, user });
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
    customers.customerUuid,
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
      customers.customerOpen ||
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
        customer_uuid_fk: customers.customerUuid,
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
      selectedCustomer: customers.selectedCustomerOption,
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

  return {
    activeAmountInputRef,
    activeInputDisplayValue,
    activeInputLak,
    activeSplitField,
    activeTab,
    activeTenderField,
    activeTenderLabel,
    allowDecimalAmount,
    backspaceActiveAmount,
    branchQrUrl,
    canPrintInvoice,
    clearActiveAmount,
    confirmOpen,
    currencyDescription,
    currencyOptions,
    customers,
    dueDate,
    exactActiveAmount,
    handleActiveAmountChange,
    handleCurrencyChange,
    handleDialogKeyDown,
    handlePaymentTabChange,
    handlePrintInvoice,
    insertDecimal,
    insertKeypadValue,
    invoice,
    invoicePrinting,
    isSplitPayment,
    note,
    open,
    onOpenChange,
    orderChannel,
    payment,
    processing,
    quickAmounts,
    replaceActiveAmount,
    requestSubmit,
    selectedCurrency,
    selectedTab,
    setActiveSplitField,
    setConfirmOpen,
    setDueDate,
    setNote,
    setOrderChannel,
    splitBillItemUuids,
    splitCashInput,
    splitTransferInput,
    submitPayment,
    summary,
    table,
    totalAmount,
    validation,
  };
}

export type PaymentDialogWorkflow = ReturnType<
  typeof usePaymentDialogWorkflow
>;
