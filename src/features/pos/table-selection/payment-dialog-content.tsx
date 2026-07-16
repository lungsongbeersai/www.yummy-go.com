"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import {
  Check,
  ChevronsUpDown,
  Clock3,
  CreditCard,
  Landmark,
  Plus,
  Printer,
  ReceiptText,
  X,
} from "lucide-react";
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
  DialogClose,
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
import { useSuppressSoftKeyboard } from "@/hooks/use-soft-keyboard-policy";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { CustomerFormDialog } from "@/features/settings/customer/customer-form-dialog";
import type { OrderChannel } from "@/services/pos";
import type { PaymentDialogWorkflow } from "./hooks/use-payment-dialog-workflow";
import { PaymentStat, PosNumpad, TenderRow } from "./payment-dialog-components";
import {
  currencyMoney,
  currencyOptionLabel,
  customerLabel,
  customerMeta,
  customerUuidOf,
  formatCurrencyInput,
  orderChannelOptions,
  parseAmount,
  paymentTabs,
} from "./payment-dialog-utils";

const DEFAULT_PAYMENT_DIALOG_HEIGHT = "100dvh";

function usePaymentDialogHeight(open: boolean) {
  const [height, setHeight] = useState(DEFAULT_PAYMENT_DIALOG_HEIGHT);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      setHeight(DEFAULT_PAYMENT_DIALOG_HEIGHT);
      return;
    }

    const viewport = window.visualViewport;
    const updateHeight = () => {
      const nextHeight = viewport?.height ?? window.innerHeight;
      setHeight(`${Math.max(320, Math.floor(nextHeight))}px`);
    };

    updateHeight();
    viewport?.addEventListener("resize", updateHeight);
    viewport?.addEventListener("scroll", updateHeight);
    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);

    return () => {
      viewport?.removeEventListener("resize", updateHeight);
      viewport?.removeEventListener("scroll", updateHeight);
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
    };
  }, [open]);

  return height;
}

interface PaymentSummaryStripItem {
  label: string;
  value: string;
  tone?: "primary" | "strong";
}

function PaymentSummaryStrip({ items }: { items: PaymentSummaryStripItem[] }) {
  return (
    <div className="grid min-h-9 grid-cols-2 overflow-hidden rounded-lg border border-border bg-card">
      {items.map((item, index) => {
        const primary = item.tone === "primary";
        const hero = index === 0;

        return (
          <div
            key={item.label}
            className={cn(
              "min-w-0 px-2 py-1.5",
              hero
                ? "col-span-2 flex items-center justify-between gap-3 border-b border-border"
                : index === 1 && "border-r border-border",
              primary && "border-primary bg-primary text-primary-foreground",
              item.tone === "strong" && "bg-muted/40",
            )}
          >
            <p
              className={cn(
                "line-clamp-2 text-[10px] leading-tight font-semibold text-muted-foreground min-[390px]:text-[11px]",
                primary && "text-primary-foreground/80",
              )}
            >
              {item.label}
            </p>
            <p
              className={cn(
                "text-right text-sm leading-tight font-black tabular-nums [overflow-wrap:anywhere] min-[390px]:text-base",
                hero && "text-base min-[390px]:text-lg",
              )}
            >
              {item.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function PaymentDialogContent({
  workflow,
}: {
  workflow: PaymentDialogWorkflow;
}) {
  const { t } = useTranslation();
  const {
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
    splitCashInput,
    splitTransferInput,
    submitPayment,
    table,
    totalAmount,
    validation,
  } = workflow;
  const {
    customerCreateOpen,
    customerCreateSaving,
    customerOpen,
    customerOptions,
    customerSearch,
    customerSearchLoading,
    customerUuid,
    handleCustomerCreateOpenChange,
    handleCustomerCreateSubmit,
    handleCustomerOpenChange,
    handleCustomerSelect,
    openCustomerCreate,
    selectedCustomerOption,
    setCustomerSearch,
  } = customers;
  const suppressSoftKeyboard = useSuppressSoftKeyboard();
  const dialogHeight = usePaymentDialogHeight(workflow.open);
  const dialogStyle = useMemo(
    () =>
      ({
        "--pos-payment-dialog-height": dialogHeight,
      }) as CSSProperties,
    [dialogHeight],
  );

  return (
    <>
      <Dialog
        open={workflow.open}
        onOpenChange={(nextOpen) =>
          !processing && !customerCreateOpen && onOpenChange(nextOpen)
        }
      >
        <DialogContent
            aria-busy={processing}
            showCloseButton={false}
            className="!left-0 !top-0 grid h-[var(--pos-payment-dialog-height)] max-h-[var(--pos-payment-dialog-height)] w-full max-w-[100vw] !translate-x-0 !translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:!left-[50%] sm:!top-[50%] sm:h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)] sm:max-w-[calc(100vw-1rem)] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-lg sm:border xl:max-w-7xl"
            style={dialogStyle}
            onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="shrink-0 border-b border-border bg-card px-3 pt-[calc(0.375rem+env(safe-area-inset-top,0px))] pb-1.5 text-left sm:px-4 sm:py-3">
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
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden items-center gap-2 sm:flex">
                  {isSplitPayment ? (
                    <Badge className="rounded-full px-3 py-1 font-black">
                      {t("pos.splitPayment")}
                    </Badge>
                  ) : null}
                  <Badge className="rounded-full px-3 py-1 font-black tabular-nums">
                    {selectedCurrency.code}
                  </Badge>
                </div>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("actions.close")}
                    className="size-11 shrink-0 rounded-full"
                    disabled={processing}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </DialogClose>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-muted/30 overscroll-contain md:grid-cols-[280px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:grid-rows-1 xl:grid-cols-[320px_minmax(0,1fr)_360px]"
            onValueChange={handlePaymentTabChange}
          >
            <aside
              className="border-b border-border bg-background p-1.5 sm:p-3 md:min-h-0 md:overflow-y-auto md:border-b-0 md:border-r lg:p-4"
              data-pos-keypad-ignore="true"
            >
              <div className="grid gap-1.5 md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)] md:gap-3 lg:h-full">
                <TabsList className="grid h-auto grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4 md:grid-cols-2 md:gap-1.5 md:p-1.5">
                  {paymentTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        aria-label={t(tab.labelKey)}
                        className="h-11 min-w-0 gap-1.5 rounded-md px-2 font-black md:gap-2"
                      >
                          <Icon aria-hidden="true" />
                          <span className="truncate">
                            {t(tab.labelKey)}
                          </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <div className="min-h-0 md:overflow-hidden">
                  <FieldGroup className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-end gap-1.5 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_2.75rem] md:grid-cols-1 md:items-stretch md:gap-3">
                    <Field
                      className="col-span-2 min-w-0 gap-0 sm:col-span-1 md:gap-1.5"
                      data-invalid={!customerUuid}
                    >
                      <div className="hidden min-h-8 items-center justify-between gap-2 md:flex">
                        <FieldLabel className="min-w-0 truncate">
                          {t("pos.customer")}
                        </FieldLabel>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="shrink-0"
                          disabled={processing || customerCreateSaving}
                          onClick={openCustomerCreate}
                        >
                          {customerCreateSaving ? (
                            <Spinner data-icon="inline-start" />
                          ) : (
                            <Plus data-icon="inline-start" />
                          )}
                          <span className="hidden min-[430px]:inline">
                            {t("actions.add")} {t("pos.customer")}
                          </span>
                          <span className="min-[430px]:hidden">
                            {t("actions.add")}
                          </span>
                        </Button>
                      </div>
                      <Popover
                        open={customerOpen}
                        onOpenChange={handleCustomerOpenChange}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            aria-label={t("pos.selectCustomer")}
                            aria-busy={customerSearchLoading}
                            aria-expanded={customerOpen}
                            aria-haspopup="listbox"
                            aria-invalid={!customerUuid}
                            className={cn(
                              "h-11 w-full justify-between px-2 text-left text-xs font-semibold md:px-3 md:text-sm",
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
                          className="w-[calc(100vw-1rem)] overflow-hidden p-0 md:w-[min(var(--radix-popover-trigger-width),calc(100vw-1rem))]"
                          side="bottom"
                          sideOffset={6}
                          onTouchMove={(event) => event.stopPropagation()}
                          onWheel={(event) => event.stopPropagation()}
                        >
                          <Command
                            className="**:data-[slot=command-input-wrapper]:h-9 **:data-[slot=command-input]:h-9 **:data-[slot=command-item]:py-2"
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

                    <Field className="col-start-1 row-start-2 min-w-0 gap-1 sm:col-start-auto sm:row-start-auto md:gap-1.5">
                      <FieldLabel className="truncate text-[11px] font-semibold text-muted-foreground md:text-sm md:text-foreground">
                        {t("pos.orderChannel")}
                      </FieldLabel>
                      <Select
                        value={String(orderChannel)}
                        onValueChange={(value) =>
                          setOrderChannel(Number(value) as OrderChannel)
                        }
                      >
                        <SelectTrigger
                          aria-label={t("pos.orderChannel")}
                          className="h-11 w-full min-w-0 px-2 text-xs font-semibold md:px-3 md:text-sm"
                        >
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
                    <Field className="col-span-2 col-start-2 row-start-2 min-w-0 gap-1 sm:col-span-1 sm:col-start-auto sm:row-start-auto md:gap-1.5">
                      <FieldLabel className="truncate text-[11px] font-semibold text-muted-foreground md:text-sm md:text-foreground">
                        {t("pos.paymentCurrency")}
                      </FieldLabel>
                      <Select
                        value={selectedCurrency.value}
                        onValueChange={handleCurrencyChange}
                      >
                        <SelectTrigger
                          aria-label={t("pos.paymentCurrency")}
                          className="h-11 w-full min-w-0 px-2 text-xs font-semibold md:px-3 md:text-sm"
                        >
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
                    <Field className="col-start-3 row-start-1 gap-0 sm:col-start-auto sm:row-start-auto md:hidden">
                      <FieldLabel className="sr-only">
                        {t("actions.add")} {t("pos.customer")}
                      </FieldLabel>
                      <Button
                        type="button"
                        variant="outline"
                        className="size-11 shrink-0 px-0"
                        aria-label={`${t("actions.add")} ${t("pos.customer")}`}
                        disabled={processing || customerCreateSaving}
                        onClick={openCustomerCreate}
                      >
                        {customerCreateSaving ? <Spinner /> : <Plus />}
                      </Button>
                    </Field>
                  </FieldGroup>

                </div>
              </div>
            </aside>

            <section className="min-h-0 overflow-y-auto overscroll-contain p-1.5 sm:p-3 lg:p-4">
              <div className="h-full min-h-0">
                {activeTenderField ? (
                  <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(196px,1fr)] gap-1.5 min-[430px]:gap-2 sm:grid-rows-[auto_auto_minmax(0,1fr)] sm:gap-3">
                    <div className="rounded-lg border border-border bg-card p-2 min-[430px]:p-2.5 lg:p-4">
                      <Field className="gap-1 min-[430px]:gap-1.5">
                        <FieldLabel htmlFor="payment-active-amount">
                          {activeTenderLabel} ({selectedCurrency.code})
                        </FieldLabel>
                        <Input
                          ref={activeAmountInputRef}
                          id="payment-active-amount"
                          inputMode={
                            suppressSoftKeyboard
                              ? "none"
                              : allowDecimalAmount
                                ? "decimal"
                                : "numeric"
                          }
                          readOnly={suppressSoftKeyboard}
                          value={activeInputDisplayValue}
                          className="h-10 text-right text-lg font-black tabular-nums min-[430px]:h-12 min-[430px]:text-2xl sm:h-14 sm:text-3xl lg:h-16 xl:text-4xl"
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
                          className="h-11 min-w-0 px-2 font-black tabular-nums lg:h-12"
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
                  <div className="grid min-h-0 place-items-center rounded-lg border border-border bg-card p-3 sm:p-4 lg:h-full">
                    <div className="grid w-full max-w-130 gap-3">
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
                  <div className="grid min-h-0 rounded-lg border border-border bg-card p-3 sm:p-4 lg:h-full">
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
              className="min-h-0 border-t border-border bg-background p-2 pb-[calc(0.5rem+var(--pos-system-bottom-safe-area))] sm:p-3 sm:pb-[calc(0.75rem+var(--pos-system-bottom-safe-area))] md:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0 lg:p-4 lg:pb-[calc(1rem+var(--pos-system-bottom-safe-area))]"
              data-pos-keypad-ignore="true"
            >
              <div className="grid min-h-0 gap-1.5 md:hidden">
                <PaymentSummaryStrip
                  items={[
                    {
                      label: t("pos.amountDue"),
                      value: money(totalAmount),
                      tone: "primary",
                    },
                    {
                      label: t("pos.amountReceived"),
                      value: money(payment.received),
                    },
                    {
                      label:
                        payment.balance > 0
                          ? t("pos.remainingAmount")
                          : t("pos.changeAmount"),
                      value: money(
                        payment.balance > 0
                          ? payment.balance
                          : payment.change,
                      ),
                      tone: "strong",
                    },
                  ]}
                />

                {validation ? (
                  <p
                    role="alert"
                    className="line-clamp-2 min-h-4 text-xs leading-tight font-semibold text-destructive"
                  >
                    {t(validation)}
                  </p>
                ) : (
                  <p className="line-clamp-2 min-h-4 text-xs leading-tight font-semibold text-muted-foreground">
                    {selectedTab ? t(selectedTab.labelKey) : t("pos.paymentTitle")}
                  </p>
                )}

                <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.25fr)] gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    className="size-11 min-w-0 px-0"
                    aria-label={t("pos.printInvoice")}
                    title={t("pos.printInvoice")}
                    disabled={!canPrintInvoice}
                    onClick={() => void handlePrintInvoice()}
                  >
                    {invoicePrinting ? <Spinner /> : <Printer />}
                    <span className="sr-only">{t("pos.printInvoice")}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-w-0 px-2"
                    disabled={processing}
                    onClick={() => onOpenChange(false)}
                  >
                    <span className="truncate">{t("actions.cancel")}</span>
                  </Button>
                  <Button
                    type="button"
                    className="h-11 min-w-0 px-2 font-black"
                    disabled={Boolean(validation) || processing}
                    onClick={requestSubmit}
                  >
                    {processing ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <ReceiptText data-icon="inline-start" />
                    )}
                    <span className="truncate">{t("pos.confirmPayment")}</span>
                  </Button>
                </div>
              </div>

              <div className="hidden min-h-0 gap-1.5 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:grid-rows-1 md:gap-2 lg:h-full lg:grid-cols-1 lg:grid-rows-[minmax(0,1fr)_auto]">
                <div className="grid min-h-0 grid-cols-3 gap-1.5 md:gap-2 lg:grid-cols-1 lg:content-start lg:gap-3">
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

                <div className="grid content-end gap-1.5 md:w-65 md:gap-2 lg:w-auto">
                  {validation ? (
                    <p
                      role="alert"
                      className="min-h-4 text-xs font-semibold text-destructive sm:min-h-5 sm:text-sm"
                    >
                      {t(validation)}
                    </p>
                  ) : (
                    <p className="min-h-4 text-xs font-semibold text-muted-foreground sm:min-h-5 sm:text-sm">
                      {selectedTab
                        ? t(selectedTab.labelKey)
                        : t("pos.paymentTitle")}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-1.5 md:gap-2 lg:grid-cols-1">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-10 min-w-0 px-2 font-black sm:h-12"
                      disabled={!canPrintInvoice}
                      onClick={() => void handlePrintInvoice()}
                    >
                      {invoicePrinting ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <Printer data-icon="inline-start" />
                      )}
                      <span className="truncate">{t("pos.printInvoice")}</span>
                    </Button>
                    <div className="contents lg:grid lg:grid-cols-2 lg:gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 min-w-0 px-2 sm:h-12"
                        disabled={processing}
                        onClick={() => onOpenChange(false)}
                      >
                        <span className="truncate">{t("actions.cancel")}</span>
                      </Button>
                      <Button
                        type="button"
                        className="h-10 min-w-0 px-2 font-black sm:h-12"
                        disabled={Boolean(validation) || processing}
                        onClick={requestSubmit}
                      >
                        {processing ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <ReceiptText data-icon="inline-start" />
                        )}
                        <span className="truncate">
                          {t("pos.confirmPayment")}
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </Tabs>
        </DialogContent>
      </Dialog>

      <CustomerFormDialog
        editing={null}
        open={customerCreateOpen}
        saving={customerCreateSaving}
        onOpenChange={handleCustomerCreateOpenChange}
        onSubmit={handleCustomerCreateSubmit}
      />

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
                <ReceiptText data-icon="inline-start" />
              )}
              {t("pos.confirmPayment")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
