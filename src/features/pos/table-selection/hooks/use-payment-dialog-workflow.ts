"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { canUseWindowOpen, isCapacitorMobileApp } from "@/lib/capacitor-platform";
import { money } from "@/lib/format";
import {
  createMutationUuid,
  ensureSplitItemUuidMap,
} from "@/lib/pos/mutation-identity";
import {
  canMoveCaretWithoutOpeningKeyboard,
  canProgrammaticallyFocusTextInput,
} from "@/lib/input-focus";
import { toApiLanguage, toLanguage } from "@/lib/language";
import { getAccountQrUrl } from "@/lib/image";
import { OrderChannelEnum, type OrderChannel } from "@/config/pos-constants";
import type {
  PaymentResponse,
  SplitBillInput,
  SplitBillResponse,
} from "@/services/pos";
import type { Exchange } from "@/services/exchange";
import { canEditStoreBranch } from "@/lib/permissions";
import type { Bank, SaveBranchAccountInput, BranchAccount } from "@/services/bank-account";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import { useDocumentLogo } from "@/features/printer/use-document-logo";
import { usePaymentCustomers } from "./use-payment-customers";
import type { PaymentDialogProps } from "../payment-dialog-types";
import {
  checkoutDocumentActionGuard,
  committedReceiptOrderUuid,
  createCommittedReceiptRetry,
  finishCommittedPayment,
  isInvoicePrintPreparationError,
  queuedDocumentPrintFailureMessage,
  queuedDocumentPrintOutcome,
  type QueuedDocumentPrintOutcome,
} from "../queued-document-print";
import {
  cartOrdersBelongToTable,
  cartOrderInvoice,
  cartOrders,
  primaryCartOrder,
} from "../utils";
import {
  openLocalInvoicePrintWindow,
  type InvoicePrintData,
} from "@/services/printer/invoice-print-window";
import { canUseSystemPrintFallback } from "@/lib/system-print-capability";
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
  formatCurrencyInput,
  formatAmountInputDisplay,
  LAK_CURRENCY_OPTION,
  LAK_CURRENCY_VALUE,
  paymentAmounts,
  paymentCurrencyAmounts,
  paymentIsExactSettlement,
  paymentNote,
  paymentTabs,
  paymentValidation,
  preferredTransferAccountUuid,
  quickCashAmounts,
  rawCaretFromDisplayCaret,
  remainingCurrencyInput,
  shouldIgnoreKeypadTarget,
  tenderInputLak,
  tenderInputValue,
  tenderLabel,
  transferAccountOptionLabel,
  transferAccountValidation,
  type PaymentTab,
  type SplitTenderField,
  type TenderField,
} from "../payment-dialog-utils";

const EMPTY_EXCHANGES: Exchange[] = [];
const EMPTY_TRANSFER_ACCOUNTS: BranchAccount[] = [];

interface QueuedDocumentContext {
  loginUuid: string;
  label: string;
  toastId: string;
  receipt?: ReturnType<typeof createCommittedReceiptRetry>;
  retryDocument?: () => void;
}

export function usePaymentDialogWorkflow({
  hasRealTable = true,
  onCompleted,
  onOpenChange,
  onTransferAccountQrChange,
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
  const fetchPosTransferAccounts = useBankAccountStore(
    (state) => state.fetchPosTransferAccounts,
  );
  const fetchBanks = useBankAccountStore((state) => state.fetchBanks);
  const saveBranchAccount = useBankAccountStore((state) => state.saveBranchAccount);
  const accountCreateRequestRef = useRef(0);
  const [accountCreateOpen, setAccountCreateOpen] = useState(false);
  const [accountCreateLoading, setAccountCreateLoading] = useState(false);
  const [accountCreateSaving, setAccountCreateSaving] = useState(false);
  const [accountBanks, setAccountBanks] = useState<Bank[]>([]);
  const accountBranchUuid = user?.branch_uuid ?? "";
  const canCreateAccount = canEditStoreBranch(user?.status) && Boolean(accountBranchUuid);
  const exchanges = (useReferenceStore((state) => state.options.exchangeRates) ?? EMPTY_EXCHANGES) as Exchange[];
  const loadExchangeRates = useReferenceStore((state) => state.loadExchangeRates);
  const exchangeRatesLoading = useReferenceStore((state) => state.loadingKeys.exchangeRates ?? false);
  const createPayment = usePosStore((state) => state.createPayment);
  const splitBill = usePosStore((state) => state.splitBill);
  const printInvoice = usePosStore((state) => state.printInvoice);
  const reprintReceipt = usePosStore((state) => state.reprintReceipt);
  const executeInvoice = usePrinterStore((state) => state.executeInvoice);
  const showToast = useToastStore((state) => state.show);
  const activeAmountInputRef = useRef<HTMLInputElement>(null);
  const paymentUuidRef = useRef("");
  const splitOperationUuidRef = useRef("");
  const splitNewOrderUuidRef = useRef("");
  const splitPaymentUuidRef = useRef("");
  const splitItemUuidMapRef = useRef<Record<string, string>>({});
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
  const [transferAccounts, setTransferAccounts] = useState<BranchAccount[]>(
    EMPTY_TRANSFER_ACCOUNTS,
  );
  const [transferAccountsLoading, setTransferAccountsLoading] = useState(false);
  const [transferAccountsFailed, setTransferAccountsFailed] = useState(false);
  const [selectedTransferAccountUuid, setSelectedTransferAccountUuid] =
    useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [invoicePrinting, setInvoicePrinting] = useState(false);
  const isSplitPayment = paymentKind === "split";
  const totalAmount = Math.max(0, Number(summary.grandTotal ?? 0));
  const invoice = cartOrderInvoice(orders);
  const orderUuid = firstOrderUuid(orders);
  const documentActionKey = JSON.stringify([user?.uuid, orderUuid]);
  const documentLogo = useDocumentLogo(open, user?.uuid, documentActionKey);
  const currencyOptions = useMemo(
    () => exchangeCurrencyOptions(exchanges),
    [exchanges],
  );
  const selectedCurrency =
    currencyOptions.find((option) => option.value === currencyValue) ??
    LAK_CURRENCY_OPTION;
  const allowDecimalAmount = currencyAllowsDecimal(selectedCurrency);
  const activeTenderField = activeAmountField(activeTab, activeSplitField);
  const settleExact = useMemo(
    () =>
      paymentIsExactSettlement(
        activeTab,
        totalAmount,
        cashInput,
        splitCashInput,
        splitTransferInput,
        selectedCurrency,
      ),
    [
      activeTab,
      cashInput,
      selectedCurrency,
      splitCashInput,
      splitTransferInput,
      totalAmount,
    ],
  );
  const payment = useMemo(
    () =>
      paymentAmounts(
        activeTab,
        totalAmount,
        cashInput,
        splitCashInput,
        splitTransferInput,
        selectedCurrency.rate,
        settleExact,
      ),
    [
      activeTab,
      cashInput,
      selectedCurrency.rate,
      settleExact,
      splitCashInput,
      splitTransferInput,
      totalAmount,
    ],
  );
  const currencyPayment = useMemo(
    () =>
      paymentCurrencyAmounts(
        activeTab,
        totalAmount,
        cashInput,
        splitCashInput,
        splitTransferInput,
        selectedCurrency,
      ),
    [
      activeTab,
      cashInput,
      selectedCurrency,
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
  const paymentAmountValidation = paymentValidation(
    activeTab,
    orderUuid,
    totalAmount,
    payment,
    customers.customerUuid,
    isSplitPayment ? splitBillItemUuids : undefined,
  );
  const requiresTransferAccount = payment.transfer > 0;
  const validation =
    paymentAmountValidation ||
    transferAccountValidation(
      payment.transfer,
      selectedTransferAccountUuid,
      transferAccountsLoading,
    );
  const hasPrintableSplitContext =
    !isSplitPayment ||
    (splitBillItemUuids.length > 0 && Boolean(customers.customerUuid));
  const canPrintInvoice =
    Boolean(orderUuid && user?.uuid) &&
    hasPrintableSplitContext &&
    !processing &&
    !invoicePrinting;
  const selectedTab =
    paymentTabs.find((tab) => tab.value === activeTab) ?? paymentTabs[0];
  const transferAccountOptions = useMemo(
    () =>
      transferAccounts.map((account) => ({
        label: transferAccountOptionLabel(account, toApiLanguage(language)),
        value: account.account_uuid,
      })),
    [language, transferAccounts],
  );
  const selectedTransferAccount =
    transferAccountOptions.find(
      (account) => account.value === selectedTransferAccountUuid,
    ) ?? null;
  const selectedTransferAccountRecord = transferAccounts.find(
    (account) => account.account_uuid === selectedTransferAccountUuid,
  );
  const accountQrValue =
    selectedTransferAccountRecord?.account_qr ||
    selectedTransferAccountRecord?.account_qr_raw ||
    "";
  const accountQrUrl = accountQrValue
    ? getAccountQrUrl(accountQrValue)
    : null;

  useEffect(() => {
    if (!onTransferAccountQrChange) return;
    onTransferAccountQrChange(
      open && requiresTransferAccount ? accountQrUrl : null,
    );
    return () => onTransferAccountQrChange(null);
  }, [accountQrUrl, onTransferAccountQrChange, open, requiresTransferAccount]);
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

  useResetOnDeps([open, accountBranchUuid, user?.uuid], () => {
    accountCreateRequestRef.current += 1;
    setAccountCreateOpen(false);
    setAccountCreateLoading(false);
    setAccountCreateSaving(false);
  });

  async function openAccountCreate() {
    if (!canCreateAccount || accountCreateLoading || processing) return;
    const requestId = accountCreateRequestRef.current;
    setAccountCreateLoading(true);
    try {
      const banks = await fetchBanks();
      if (requestId !== accountCreateRequestRef.current) return;
      setAccountBanks(banks);
      setAccountCreateOpen(true);
    } catch (error) {
      if (requestId !== accountCreateRequestRef.current) return;
      showToast({ title: t("settings.bankAccount.loadReferencesFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      if (requestId === accountCreateRequestRef.current) setAccountCreateLoading(false);
    }
  }

  async function savePaymentAccount(input: SaveBranchAccountInput) {
    if (!canCreateAccount || accountCreateSaving) return;
    const requestId = accountCreateRequestRef.current;
    setAccountCreateSaving(true);
    try {
      const created = await saveBranchAccount({ ...input, branch_uuid_fk: accountBranchUuid });
      if (requestId !== accountCreateRequestRef.current) return;
      setAccountCreateOpen(false);
      showToast({ title: t("settings.storeBranch.transferAccountSaved"), tone: "success" });
      setTransferAccountsLoading(true);
      try {
        const accounts = await fetchPosTransferAccounts();
        if (requestId !== accountCreateRequestRef.current) return;
        setTransferAccounts(accounts);
        setTransferAccountsFailed(false);
        setSelectedTransferAccountUuid(preferredTransferAccountUuid(accounts, created?.account_uuid || selectedTransferAccountUuid));
      } catch (error) {
        if (requestId !== accountCreateRequestRef.current) return;
        setTransferAccountsFailed(true);
        showToast({ title: t("pos.transferAccountsUnavailable"), description: error instanceof Error ? error.message : "", tone: "error" });
      } finally {
        if (requestId === accountCreateRequestRef.current) setTransferAccountsLoading(false);
      }
    } catch (error) {
      if (requestId !== accountCreateRequestRef.current) return;
      showToast({ title: t("settings.saveFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      if (requestId === accountCreateRequestRef.current) setAccountCreateSaving(false);
    }
  }

  // เปิด dialog ชำระเงิน = ตั้งค่าฟอร์มใหม่ทั้งชุดทันที (แยกจาก effect ที่โหลดอัตราแลกเปลี่ยน)
  useResetOnChange(open, () => {
    if (!open) return;
    const defaultAmount = defaultCurrencyInput(totalAmount, LAK_CURRENCY_OPTION);
    setActiveTab("cash");
    setActiveSplitField("cash");
    setCashInput(defaultAmount);
    setSplitCashInput("");
    setSplitTransferInput(defaultAmount);
    setOrderChannel(OrderChannelEnum.DINE_IN);
    setCurrencyValue(LAK_CURRENCY_VALUE);
    setDueDate("");
    setNote("");
    setTransferAccounts(EMPTY_TRANSFER_ACCOUNTS);
    setTransferAccountsLoading(true);
    setTransferAccountsFailed(false);
    setSelectedTransferAccountUuid("");
    setConfirmOpen(false);
    paymentUuidRef.current = createMutationUuid();
    splitOperationUuidRef.current = createMutationUuid();
    splitNewOrderUuidRef.current = createMutationUuid();
    splitPaymentUuidRef.current = createMutationUuid();
    splitItemUuidMapRef.current = {};
  }, { runOnMount: true });

  useEffect(() => {
    if (!open) return;
    void loadExchangeRates({
      lang: toApiLanguage(language),
    }).catch(() => undefined);
  }, [isSplitPayment, language, loadExchangeRates, open, totalAmount, user]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    void fetchPosTransferAccounts()
      .then((accounts) => {
        if (!active) return;
        setTransferAccounts(accounts);
        setSelectedTransferAccountUuid((currentAccountUuid) =>
          preferredTransferAccountUuid(accounts, currentAccountUuid),
        );
      })
      .catch(() => {
        if (!active) return;
        setTransferAccounts([]);
        setTransferAccountsFailed(true);
      })
      .finally(() => {
        if (active) setTransferAccountsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchPosTransferAccounts, open]);

  // สกุลเงินที่เลือกหลุดจากรายการ (โหลดอัตราใหม่/สลับร้าน) = กลับไปใช้ LAK
  useResetOnDeps([currencyOptions, currencyValue], () => {
    if (!currencyOptions.some((option) => option.value === currencyValue))
      setCurrencyValue(LAK_CURRENCY_VALUE);
  });

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
    if (field === "split_cash") {
      setSplitCashInput(nextValue);
      setSplitTransferInput(
        remainingCurrencyInput(totalAmount, nextValue, selectedCurrency),
      );
    }
    if (field === "split_transfer") {
      setSplitTransferInput(nextValue);
      setSplitCashInput(
        remainingCurrencyInput(totalAmount, nextValue, selectedCurrency),
      );
    }
    return nextValue;
  }

  function focusActiveAmount(caret?: number) {
    window.requestAnimationFrame(() => {
      const input = activeAmountInputRef.current;
      if (!input) return;
      const inputAlreadyFocused = canMoveCaretWithoutOpeningKeyboard(input);
      if (!inputAlreadyFocused && !canProgrammaticallyFocusTextInput()) return;
      if (!inputAlreadyFocused) input.focus();
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
      customers.customerCreateOpen ||
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
    if (
      validation ||
      processing ||
      invoicePrinting ||
      checkoutDocumentActionGuard.isActive(documentActionKey)
    ) return;
    setConfirmOpen(true);
  }

  async function submitPayment() {
    if (validation || processing || invoicePrinting || !user?.uuid) return;
    if (!cartOrdersBelongToTable(orders, table)) {
      showToast({ title: t("pos.paymentMissingOrder"), tone: "error" });
      return;
    }

    const releaseAction = checkoutDocumentActionGuard.acquire(documentActionKey);
    if (!releaseAction) return;

    let paymentCommitted = false;
    setProcessing(true);
    try {
      if (!paymentUuidRef.current) paymentUuidRef.current = createMutationUuid();
      if (!splitOperationUuidRef.current) splitOperationUuidRef.current = createMutationUuid();
      if (!splitNewOrderUuidRef.current) splitNewOrderUuidRef.current = createMutationUuid();
      if (!splitPaymentUuidRef.current) splitPaymentUuidRef.current = createMutationUuid();
      const paymentPayload = {
        ...(typeof documentLogo.showLogo === "boolean" ? { show_logo: documentLogo.showLogo } : {}),
        order_uuid: orderUuid,
        ...(hasRealTable ? { table_uuid: table.table_uuid } : {}),
        customer_uuid_fk: customers.customerUuid,
        ...(requiresTransferAccount && selectedTransferAccountUuid
          ? { account_uuid_fk: selectedTransferAccountUuid }
          : {}),
        payment_method: selectedTab.method,
        amount: totalAmount,
        cash_payment_amount: payment.cash,
        transfer_payment_amount: payment.transfer,
        change_amount: payment.change,
        payment_currency: selectedCurrency.code,
        foreign_paid: formatCurrencyInput(
          currencyPayment.foreignPaid,
          selectedCurrency,
        ),
        foreign_cash_paid: formatCurrencyInput(
          currencyPayment.foreignCashPaid,
          selectedCurrency,
        ),
        foreign_transfer_paid: formatCurrencyInput(
          currencyPayment.foreignTransferPaid,
          selectedCurrency,
        ),
        settle_exact: settleExact,
        due_date: activeTab === "arrears" ? dueDate || undefined : undefined,
        note: paymentNote(activeTab, note),
        login_uuid_fk: user.uuid,
      };
      const response = isSplitPayment
        ? await splitBill({
            ...paymentPayload,
            sync_event_uuid: splitOperationUuidRef.current,
            new_order_uuid: splitNewOrderUuidRef.current,
            payment_uuid: splitPaymentUuidRef.current,
            split_item_uuid_map: (splitItemUuidMapRef.current =
              ensureSplitItemUuidMap(
                splitBillItemUuids,
                splitItemUuidMapRef.current,
              )),
            order_item_uuids: splitBillItemUuids,
            document_type: "receipt",
            order_channel: orderChannel,
            lang: toLanguage(language),
          })
        : await createPayment({
            ...paymentPayload,
            payment_uuid: paymentUuidRef.current,
            order_channel: orderChannel,
            paid_at: null,
            lang: toApiLanguage(language),
          });

      paymentCommitted = true;
      const context = queuedPrintContext(response, user.uuid);
      context.receipt = createCommittedReceiptRetry({
        receipt: {
          order_uuid: committedReceiptOrderUuid(
            response,
            isSplitPayment ? splitNewOrderUuidRef.current : orderUuid,
            isSplitPayment,
          ),
          payment_uuid: response.payment?.payment_uuid,
          login_uuid_fk: context.loginUuid,
          lang: language,
          ...(typeof documentLogo.showLogo === "boolean" ? { show_logo: documentLogo.showLogo } : {}),
        },
        requestReceipt: reprintReceipt,
        execute: (pendingQuery) => executeQueuedInvoice(
          { pending_query: pendingQuery },
          context,
          t("pos.paymentReceiptPrintFailed"),
        ),
        createOperationUuid: createMutationUuid,
        missingJobMessage: t("pos.invoicePrintMissingJob"),
      });
      const result = await finishCommittedPayment({
        print: () => printReceipt(response, context),
        onCommitted: (printOutcome) => {
          const store = usePosStore.getState();
          if (firstOrderUuid(cartOrders(primaryCartOrder(store.cart))) === orderUuid) {
            store.invalidateCart();
          }
          if (printOutcome === "success") {
            showToast({
              title: t(isSplitPayment ? "pos.splitPaymentCreated" : "pos.paymentSuccess"),
              tone: "success",
            });
          }
          onOpenChange(false);
        },
        refresh: onCompleted,
        onPrintError: (error) => showQueuedPrintError(
          t("pos.paymentReceiptPrintFailed"),
          error instanceof Error ? error.message : "",
          () => void retryCommittedReceipt(context),
          context,
        ),
      });
      if ("completionError" in result || "refreshError" in result) {
        showToast({
          title: t("pos.paymentRefreshFailed"),
          description: context.label,
          tone: "warning",
        });
      }
    } catch (error) {
      showToast({
        title: t(paymentCommitted
          ? "pos.paymentRefreshFailed"
          : isSplitPayment ? "pos.splitPaymentFailed" : "pos.paymentFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      releaseAction();
      setProcessing(false);
      setConfirmOpen(false);
    }
  }

  function queuedPrintContext(
    response: PaymentResponse | SplitBillResponse,
    loginUuid: string,
  ): QueuedDocumentContext {
    const responseInvoice = response.new_order_invoice ?? response.order_invoice;
    const documentInvoice = typeof responseInvoice === "string" ? responseInvoice : invoice || orderUuid;
    const printJobUuid = response.pending_query?.print_job_uuid ?? response.print_job?.print_job_uuid;
    return {
      loginUuid,
      label: [
        `${t("pos.invoicePrintNumber")}: ${documentInvoice}`,
        hasRealTable ? `${t("pos.invoicePrintTable")}: ${table.table_name}` : "",
      ].filter(Boolean).join(" · "),
      toastId: `document-print:${printJobUuid || documentInvoice}`,
    };
  }

  async function printReceipt(
    response: PaymentResponse | SplitBillResponse,
    context: QueuedDocumentContext,
  ): Promise<QueuedDocumentPrintOutcome> {
    const pendingJobUuid =
      response.pending_query?.print_job_uuid ??
      (typeof response.print_job?.print_job_uuid === "string"
        ? response.print_job.print_job_uuid
        : "");
    if (!pendingJobUuid) {
      throw new Error(queuedDocumentPrintFailureMessage(response, t("pos.invoicePrintMissingJob")));
    }

    return executeQueuedInvoice(
      response,
      context,
      t("pos.paymentReceiptPrintFailed"),
    );
  }

  async function retryCommittedReceipt(context: QueuedDocumentContext, newPrintRound = true) {
    const receipt = context.receipt;
    if (!receipt?.orderUuid) return;
    const releaseAction = checkoutDocumentActionGuard.acquire(
      JSON.stringify(["receipt-retry", context.loginUuid, receipt.orderUuid]),
    );
    if (!releaseAction) return;

    setInvoicePrinting(true);
    try {
      // The financial mutation is committed. Rebuild only this paid order's
      // receipt as a new manual print, without submitting payment again.
      await receipt.retry(newPrintRound);
    } catch (error) {
      showQueuedPrintError(
        t("pos.paymentReceiptPrintFailed"),
        error instanceof Error ? error.message : "",
        () => void retryCommittedReceipt(context),
        context,
      );
    } finally {
      releaseAction();
      setInvoicePrinting(false);
    }
  }

  async function handlePrintInvoice() {
    if (!orderUuid || !user?.uuid || processing || invoicePrinting) return;
    if (isSplitPayment && !splitBillItemUuids.length) {
      showToast({ title: t("pos.splitPaymentSelectRequired"), tone: "error" });
      return;
    }
    if (isSplitPayment && !customers.customerUuid) {
      showToast({ title: t("pos.paymentCustomerRequired"), tone: "error" });
      return;
    }
    if (!cartOrdersBelongToTable(orders, table)) {
      showToast({ title: t("pos.paymentMissingOrder"), tone: "error" });
      return;
    }

    const releaseAction = checkoutDocumentActionGuard.acquire(documentActionKey);
    if (!releaseAction) return;

    const invoicePrintData = () => buildInvoicePrintData({
      showLogo: documentLogo.previewShowInvoiceLogo,
      exchangeRates: currencyOptions,
      invoice,
      orders,
      qrUrl: requiresTransferAccount ? accountQrUrl : null,
      selectedCustomer: customers.selectedCustomerOption,
      summary,
      table,
      translate: (key, options) => String(t(key, options)),
      user,
    });

    setInvoicePrinting(true);
    try {
      const response = isSplitPayment
        ? await splitBill({
            order_uuid: orderUuid,
            order_item_uuids: splitBillItemUuids,
            document_type: "invoice",
            ...(typeof documentLogo.showLogo === "boolean" ? { show_logo: documentLogo.showLogo } : {}),
            order_channel: orderChannel,
            customer_uuid_fk: customers.customerUuid,
            ...(requiresTransferAccount && selectedTransferAccountUuid
              ? { account_uuid_fk: selectedTransferAccountUuid }
              : {}),
            payment_method: selectedTab.method,
            amount: totalAmount,
            cash_payment_amount: payment.cash,
            transfer_payment_amount: payment.transfer,
            change_amount: payment.change,
            payment_currency: selectedCurrency.code,
            foreign_paid: formatCurrencyInput(
              currencyPayment.foreignPaid,
              selectedCurrency,
            ),
            foreign_cash_paid: formatCurrencyInput(
              currencyPayment.foreignCashPaid,
              selectedCurrency,
            ),
            foreign_transfer_paid: formatCurrencyInput(
              currencyPayment.foreignTransferPaid,
              selectedCurrency,
            ),
            settle_exact: settleExact,
            note: paymentNote(activeTab, note),
            lang: toLanguage(language),
            login_uuid_fk: user.uuid,
          } satisfies SplitBillInput)
        : await printInvoice({
            ...(typeof documentLogo.showLogo === "boolean" ? { show_logo: documentLogo.showLogo } : {}),
            order_uuid: orderUuid,
            operation_uuid: createMutationUuid(),
            ...(requiresTransferAccount && selectedTransferAccountUuid
              ? { account_uuid_fk: selectedTransferAccountUuid }
              : {}),
            lang: toApiLanguage(language),
            login_uuid_fk: user.uuid,
          });
      const pendingJobUuid =
        response.pending_query?.print_job_uuid ??
        (typeof response.print_job?.print_job_uuid === "string"
          ? response.print_job.print_job_uuid
          : "");

      if (!pendingJobUuid) {
        await showInvoicePrintFallback(
          invoicePrintData(),
          queuedDocumentPrintFailureMessage(response, t("pos.invoicePrintMissingJob")),
        );
        return;
      }

      await executeQueuedInvoice(
        response,
        {
          ...queuedPrintContext(response, user.uuid),
          retryDocument: () => void handlePrintInvoice(),
        },
        t("pos.invoicePrintFailed"),
      );
    } catch (error) {
      // This failure means Backend could not read the bill's actual items.
      // A cached cart is not a safe substitute for that invoice snapshot.
      if (isInvoicePrintPreparationError(error)) {
        showToast({
          title: t("pos.invoicePrintFailed"),
          description: t("pos.invoicePrintPreparationFailed"),
          tone: "error",
          action: {
            label: t("actions.tryAgain"),
            onClick: () => void handlePrintInvoice(),
          },
        });
        return;
      }
      await showInvoicePrintFallback(
        invoicePrintData(),
        error instanceof Error ? error.message : "",
      );
    } finally {
      releaseAction();
      setInvoicePrinting(false);
    }
  }

  async function executeQueuedInvoice(
    response: PaymentResponse | SplitBillResponse,
    context: QueuedDocumentContext,
    failureTitle: string,
  ): Promise<QueuedDocumentPrintOutcome> {
    const retry = context.receipt
      ? () => void retryCommittedReceipt(context, true)
      : context.retryDocument;
    setInvoicePrinting(true);
    try {
      const printResult = await executeInvoice({
        print_job: response.print_job,
        pending_query: response.pending_query,
        login_uuid_fk: context.loginUuid,
      });
      const outcome = queuedDocumentPrintOutcome(printResult);

      if (outcome === "pending") {
        showToast({
          id: context.toastId,
          title: t("pos.documentPrintQueued"),
          ...(context.receipt ? {
            title: t("pos.paymentReceiptPrintQueued"),
          } : {}),
          description: context.label,
          tone: "info",
        });
        return outcome;
      }

      if (outcome === "success") {
        showToast({ id: context.toastId, title: t("common.printSuccess"), description: context.label, tone: "success", duration: 4000 });
        return outcome;
      }

      showQueuedPrintError(
        failureTitle,
        printResult.errorMessage,
        retry,
        context,
      );
      return outcome;
    } catch (error) {
      showQueuedPrintError(
        failureTitle,
        error instanceof Error ? error.message : "",
        retry,
        context,
      );
      return "error";
    } finally {
      setInvoicePrinting(false);
    }
  }

  function showQueuedPrintError(
    title: string,
    description: string | undefined,
    retry: (() => void) | undefined,
    context?: QueuedDocumentContext,
  ) {
    const retryDescription = context?.receipt
      ? t("pos.paidReceiptRetryDescription")
      : context?.retryDocument ? "" : t("pos.autoPrintRetryDescription");
    showToast({
      ...(context ? { id: context.toastId } : {}),
      ...(context?.receipt ? { duration: Infinity } : {}),
      title,
      description: [context?.label, description, retryDescription]
        .filter(Boolean)
        .join(" "),
      tone: "error",
      ...(retry ? {
        action: {
          label: t("pos.manualReprint"),
          onClick: (event) => {
            if (context?.receipt) event.preventDefault();
            retry();
          },
        },
      } : {}),
    });
  }

  async function showInvoicePrintFallback(
    data: InvoicePrintData,
    description: string,
  ) {
    if (isCapacitorMobileApp()) {
      showQueuedPrintError(
        t("pos.invoicePrintFailed"),
        description || t("pos.invoicePrintMissingJob"),
        () => void handlePrintInvoice(),
      );
      return;
    }

    if (!canUseWindowOpen()) {
      showToast({
        title: t("pos.invoicePrintFailed"),
        description: t("pos.invoicePrintPopupBlocked"),
        tone: "error",
      });
      return;
    }

    if (!canUseSystemPrintFallback()) {
      showToast({
        title: t("pos.invoicePrintFailed"),
        description: t("pos.systemPrinterUnavailable"),
        tone: "info",
      });
      return;
    }

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
    documentLogo,
    accountBanks,
    accountBranchUuid,
    accountCreateLoading,
    accountCreateOpen,
    accountCreateSaving,
    canCreateAccount,
    openAccountCreate,
    savePaymentAccount,
    setAccountCreateOpen,
    activeAmountInputRef,
    activeInputDisplayValue,
    activeInputLak,
    activeSplitField,
    activeTab,
    activeTenderField,
    activeTenderLabel,
    allowDecimalAmount,
    backspaceActiveAmount,
    accountQrUrl,
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
    selectedTransferAccount,
    selectedTransferAccountUuid,
    selectedTab,
    setActiveSplitField,
    setConfirmOpen,
    setDueDate,
    setNote,
    setOrderChannel,
    setSelectedTransferAccountUuid,
    splitBillItemUuids,
    splitCashInput,
    splitTransferInput,
    submitPayment,
    summary,
    table,
    totalAmount,
    transferAccountOptions,
    transferAccountsFailed,
    transferAccountsLoading,
    validation,
  };
}

export type PaymentDialogWorkflow = ReturnType<
  typeof usePaymentDialogWorkflow
>;
