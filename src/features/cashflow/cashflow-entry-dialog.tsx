"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
} from "@/features/settings/shared/settings-shell";
import { businessDateInputValue } from "@/lib/format";
import { internalRoute } from "@/lib/routes";
import { createUuid } from "@/lib/uuid";
import type {
  CashflowCategory,
  CashflowCurrency,
  CashflowDirection,
  CashflowEntry,
  CashflowExpenseGroup,
  CashflowPaymentMethod,
  SaveCashflowEntryInput,
} from "@/services/cashflow";
import {
  cashflowAmountValue,
  formatCashflowAmount,
  isCashflowDate,
} from "./cashflow-ui-utils";
import { CashflowSelectField } from "./cashflow-workspace";

interface CashflowEntryDialogProps {
  branchUuid: string;
  branchLabel: string;
  editing: CashflowEntry | null;
  initialDirection: CashflowDirection;
  categories: CashflowCategory[];
  categoriesLoading: boolean;
  open: boolean;
  saving: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: SaveCashflowEntryInput) => Promise<void>;
}

export function CashflowEntryDialog({
  branchUuid,
  branchLabel,
  editing,
  initialDirection,
  categories,
  categoriesLoading,
  open,
  saving,
  error,
  onOpenChange,
  onSave,
}: CashflowEntryDialogProps) {
  const { t } = useTranslation();
  const [entryUuid] = useState(() => editing?.entry_uuid || createUuid());
  const [direction, setDirection] = useState<CashflowDirection>(
    editing?.direction ?? initialDirection
  );
  const [expenseGroup, setExpenseGroup] = useState<CashflowExpenseGroup>(
    editing?.expense_group ?? "shop"
  );
  const [categoryUuid, setCategoryUuid] = useState(
    editing?.category_uuid_fk ?? ""
  );
  const [date, setDate] = useState(
    editing?.entry_date.slice(0, 10) ?? businessDateInputValue()
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [currency, setCurrency] = useState<CashflowCurrency>(
    editing?.currency ?? "LAK"
  );
  const [paymentMethod, setPaymentMethod] = useState<CashflowPaymentMethod>(
    editing?.payment_method ?? "cash"
  );
  const [reference, setReference] = useState(editing?.reference ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [submitted, setSubmitted] = useState(false);
  const activeCategories = categories.filter(
    (category) =>
      (category.is_active ||
        category.category_uuid === editing?.category_uuid_fk) &&
      (category.direction === "both" || category.direction === direction)
  );
  const selectedCategory = activeCategories.find(
    (category) => category.category_uuid === categoryUuid
  );
  const amountValue = cashflowAmountValue(amount);
  const valid = Boolean(
    branchUuid &&
      selectedCategory &&
      isCashflowDate(date) &&
      description.trim() &&
      amountValue !== null
  );
  const sameSavedCurrency = Boolean(editing && currency === editing.currency);
  const retainedRate =
    editing && sameSavedCurrency ? editing.exchange_rate : null;
  const basePreview =
    amountValue !== null && currency === "LAK"
      ? amountValue
      : amountValue !== null && retainedRate !== null
      ? Math.round(amountValue * retainedRate * 100) / 100
      : null;

  function submit() {
    setSubmitted(true);
    if (!valid || saving || amountValue === null) return;
    void onSave({
      branch_uuid_fk: branchUuid,
      entry_uuid: entryUuid,
      ...(editing ? { version: editing.version } : {}),
      entry_date: date,
      direction,
      expense_group: direction === "expense" ? expenseGroup : null,
      category_uuid_fk: categoryUuid,
      description: description.trim(),
      amount: amountValue,
      currency,
      payment_method: paymentMethod,
      reference: reference.trim(),
      note: note.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-2xl" showCloseButton={!saving}>
        <SettingsDialogForm
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <SettingsDialogHeader>
            <DialogTitle>
              {editing
                ? t("cashflow.editEntry", { defaultValue: "Edit entry" })
                : t(
                    direction === "income"
                      ? "cashflow.addIncome"
                      : "cashflow.addExpense",
                    {
                      defaultValue:
                        direction === "income"
                          ? "Add other income"
                          : "Add expense",
                    }
                  )}
            </DialogTitle>
            <DialogDescription>{branchLabel}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody className="flex flex-col gap-5">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {submitted && !valid ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {t("cashflow.entryValidation", {
                    defaultValue:
                      "Choose a valid date and category, enter a description and a positive amount with up to two decimal places.",
                  })}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <CashflowSelectField
                id="cashflow-form-direction"
                label={t("cashflow.directionLabel", { defaultValue: "Type" })}
                value={direction}
                disabled={saving}
                onValueChange={(value) => {
                  setDirection(value as CashflowDirection);
                  setCategoryUuid("");
                }}
                options={[
                  {
                    value: "income",
                    label: t("cashflow.otherIncome", {
                      defaultValue: "Other income",
                    }),
                  },
                  {
                    value: "expense",
                    label: t("cashflow.directions.expense", {
                      defaultValue: "Expense",
                    }),
                  },
                ]}
              />
              <Field className="gap-2">
                <FieldLabel htmlFor="cashflow-form-date">
                  {t("cashflow.fields.date", { defaultValue: "Date" })}
                </FieldLabel>
                <Input
                  id="cashflow-form-date"
                  className="min-h-11"
                  type="date"
                  required
                  disabled={saving}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
              {direction === "expense" ? (
                <CashflowSelectField
                  id="cashflow-form-expense-group"
                  label={t("cashflow.fields.expenseGroup", {
                    defaultValue: "Expense group",
                  })}
                  value={expenseGroup}
                  disabled={saving}
                  onValueChange={(value) =>
                    setExpenseGroup(value as CashflowExpenseGroup)
                  }
                  options={[
                    {
                      value: "shop",
                      label: t("cashflow.expenseGroups.shop", {
                        defaultValue: "Shop expense",
                      }),
                    },
                    {
                      value: "other",
                      label: t("cashflow.expenseGroups.other", {
                        defaultValue: "Other expense",
                      }),
                    },
                  ]}
                />
              ) : null}
              <CashflowSelectField
                id="cashflow-form-category"
                label={t("cashflow.fields.category", {
                  defaultValue: "Category",
                })}
                value={selectedCategory ? categoryUuid : "__none"}
                disabled={saving || categoriesLoading}
                onValueChange={setCategoryUuid}
                options={[
                  {
                    value: "__none",
                    label: t("cashflow.chooseCategory", {
                      defaultValue: "Choose a category",
                    }),
                    disabled: true,
                  },
                  ...activeCategories.map((category) => ({
                    value: category.category_uuid,
                    label: `${category.name}${
                      category.is_active ? "" : ` (${t("common.inactive")})`
                    }`,
                  })),
                ]}
              />
            </div>
            {!categoriesLoading && !activeCategories.length ? (
              <Alert>
                <AlertDescription className="text-sm">
                  {t("cashflow.categoryRequiredHint", {
                    defaultValue:
                      "Add an active category for this entry type before recording an entry.",
                  })}{" "}
                  <Link
                    href={internalRoute("/finance/categories")}
                    className="font-semibold underline underline-offset-4"
                  >
                    {t("cashflow.manageCategories", {
                      defaultValue: "Manage categories",
                    })}
                  </Link>
                </AlertDescription>
              </Alert>
            ) : null}
            <Field className="gap-2">
              <FieldLabel htmlFor="cashflow-form-description">
                {t("cashflow.fields.description", {
                  defaultValue: "Description",
                })}
              </FieldLabel>
              <Input
                id="cashflow-form-description"
                className="min-h-11"
                required
                maxLength={500}
                disabled={saving}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("cashflow.descriptionPlaceholder", {
                  defaultValue: "What was this income or expense for?",
                })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-2">
                <FieldLabel htmlFor="cashflow-form-amount">
                  {t("cashflow.fields.amount", { defaultValue: "Amount" })}
                </FieldLabel>
                <FormattedNumberInput
                  id="cashflow-form-amount"
                  className="min-h-11"
                  decimal
                  required
                  disabled={saving}
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="0.00"
                  aria-invalid={Boolean(amount && amountValue === null)}
                />
                <FieldDescription className="text-sm">
                  {t("cashflow.positiveAmountHint", {
                    defaultValue:
                      "Enter an amount greater than zero with up to two decimal places.",
                  })}
                </FieldDescription>
              </Field>
              <CashflowSelectField
                id="cashflow-form-currency"
                label={t("cashflow.fields.currency", {
                  defaultValue: "Currency",
                })}
                value={currency}
                disabled={saving}
                onValueChange={(value) =>
                  setCurrency(value as CashflowCurrency)
                }
                options={[
                  { value: "LAK", label: "LAK — ₭" },
                  { value: "THB", label: "THB — ฿" },
                  { value: "USD", label: "USD — $" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
              {basePreview !== null ? (
                <p className="text-sm font-semibold tabular-nums">
                  {t("cashflow.fields.baseAmount", {
                    defaultValue: "Amount in LAK",
                  })}
                  : {formatCashflowAmount(basePreview)}
                </p>
              ) : null}
              <p className="text-sm leading-6 text-muted-foreground">
                {retainedRate !== null && currency !== "LAK"
                  ? `${t("cashflow.fields.exchangeRate", {
                      defaultValue: "Saved exchange rate",
                    })}: 1 ${currency} = ${formatCashflowAmount(retainedRate)}`
                  : t("cashflow.exchangeRateHint", {
                      defaultValue:
                        "The current exchange rate is saved when creating an entry or changing currency.",
                    })}
              </p>
            </div>
            <CashflowSelectField
              id="cashflow-form-payment"
              label={t("cashflow.fields.paymentMethod", {
                defaultValue: "Payment method",
              })}
              value={paymentMethod}
              disabled={saving}
              onValueChange={(value) =>
                setPaymentMethod(value as CashflowPaymentMethod)
              }
              options={(["cash", "transfer", "other"] as const).map(
                (value) => ({
                  value,
                  label: t(`cashflow.paymentMethods.${value}`, {
                    defaultValue:
                      value === "cash"
                        ? "Cash"
                        : value === "transfer"
                        ? "Bank transfer"
                        : "Other",
                  }),
                })
              )}
            />
            <Field className="gap-2">
              <FieldLabel htmlFor="cashflow-form-reference">
                {t("cashflow.fields.reference", { defaultValue: "Reference" })}
              </FieldLabel>
              <Input
                id="cashflow-form-reference"
                className="min-h-11"
                maxLength={120}
                disabled={saving}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={t("cashflow.referencePlaceholder", {
                  defaultValue: "Receipt or reference number (optional)",
                })}
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="cashflow-form-note">
                {t("cashflow.fields.note", { defaultValue: "Note" })}
              </FieldLabel>
              <Textarea
                id="cashflow-form-note"
                maxLength={2000}
                disabled={saving}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
              />
            </Field>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!valid || saving || categoriesLoading}
            >
              {saving ? <Spinner aria-hidden /> : null}
              {t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
