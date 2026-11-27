"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { SettingsDialogBody, SettingsDialogContent, SettingsDialogFooter, SettingsDialogForm, SettingsDialogHeader } from "@/features/settings/shared/settings-shell";
import { businessDateInputValue } from "@/lib/format";
import { createUuid } from "@/lib/uuid";
import type { CashflowCategory, CashflowDirection, CashflowEntry, SaveCashflowEntryInput } from "@/services/cashflow";
import { CashflowCategoryBadges } from "./cashflow-category-badges";
import { cashflowEntryNote, compactCashflowEntryInput } from "./cashflow-entry-input";
import { cashflowAmountValue, isCashflowDate } from "./cashflow-ui-utils";

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

export function CashflowEntryDialog({ branchUuid, branchLabel, editing, initialDirection, categories, categoriesLoading, open, saving, error, onOpenChange, onSave }: CashflowEntryDialogProps) {
  const { t } = useTranslation();
  const [entryUuid] = useState(() => editing?.entry_uuid || createUuid());
  const direction = editing?.direction ?? initialDirection;
  const [categoryUuid, setCategoryUuid] = useState(editing?.category_uuid_fk ?? "");
  const [date, setDate] = useState(editing?.entry_date.slice(0, 10) ?? businessDateInputValue());
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [note, setNote] = useState(editing ? cashflowEntryNote(editing) : "");
  const category = categories.find((row) => row.category_uuid === categoryUuid &&
    (row.is_active || row.category_uuid === editing?.category_uuid_fk) && (row.direction === "both" || row.direction === direction));
  const amountValue = cashflowAmountValue(amount);
  // Category is optional: without one the backend files the entry under "General".
  const valid = Boolean(branchUuid && (!categoryUuid || category) && isCashflowDate(date) && amountValue !== null);
  const currency = editing?.currency ?? "LAK";

  function submit() {
    if (!valid || saving || amountValue === null) return;
    void onSave(compactCashflowEntryInput({ branchUuid, entryUuid, editing, category: category ?? null,
      generalLabel: t("cashflow.generalCategory"), direction, date, amount: amountValue, note }));
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <SettingsDialogContent className="sm:max-w-xl" showCloseButton={!saving}>
      <SettingsDialogForm onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <SettingsDialogHeader className="gap-1 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{editing ? t("cashflow.editEntry") : t(direction === "income" ? "cashflow.addIncome" : "cashflow.addExpense")}</DialogTitle>
            <Badge variant="outline" className={`min-h-7 gap-1.5 text-sm ${direction === "income" ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
              {direction === "income" ? <ArrowDownLeft aria-hidden /> : <ArrowUpRight aria-hidden />}{t(`cashflow.directions.${direction}`)}
            </Badge>
          </div>
          <DialogDescription className="truncate text-sm">{branchLabel}</DialogDescription>
        </SettingsDialogHeader>
        <SettingsDialogBody className="flex flex-col gap-4 p-4 sm:p-5">
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <Field className="gap-2"><FieldLabel htmlFor="cashflow-form-date">{t("cashflow.fields.date")}</FieldLabel><Input id="cashflow-form-date" className="min-h-11" type="date" required disabled={saving} value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field className="gap-2"><FieldLabel>{t("cashflow.fields.category")}</FieldLabel><CashflowCategoryBadges categories={categories} direction={direction} selectedUuid={categoryUuid} onSelect={(uuid) => setCategoryUuid((current) => current === uuid && !editing ? "" : uuid)} retainedCategoryUuid={editing?.category_uuid_fk} disabled={saving} loading={categoriesLoading} />{!editing ? <p className="text-xs text-muted-foreground">{t("cashflow.categoryOptionalHint")}</p> : null}</Field>
          <Field className="gap-2"><FieldLabel htmlFor="cashflow-form-amount">{t("cashflow.fields.amount")} ({currency})</FieldLabel><FormattedNumberInput id="cashflow-form-amount" className="min-h-11 text-lg font-semibold tabular-nums" decimal required disabled={saving} value={amount} onValueChange={setAmount} placeholder="0.00" aria-invalid={Boolean(amount && amountValue === null)} /></Field>
          <Field className="gap-2"><FieldLabel htmlFor="cashflow-form-note">{t("cashflow.fields.note")}</FieldLabel><Textarea id="cashflow-form-note" maxLength={2000} disabled={saving} value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="min-h-16 resize-y" /></Field>
        </SettingsDialogBody>
        <SettingsDialogFooter className="grid grid-cols-2 gap-2 px-4 py-3 sm:flex sm:px-5"><Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button><Button type="submit" disabled={!valid || saving || categoriesLoading}>{saving ? <Spinner aria-hidden /> : null}{t("actions.save")}</Button></SettingsDialogFooter>
      </SettingsDialogForm>
    </SettingsDialogContent>
  </Dialog>;
}
