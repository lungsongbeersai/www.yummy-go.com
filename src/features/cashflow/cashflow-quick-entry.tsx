"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { businessDateInputValue } from "@/lib/format";
import { createUuid } from "@/lib/uuid";
import type { CashflowDirection, CashflowEntry, SaveCashflowEntryInput } from "@/services/cashflow";
import { compactCashflowEntryInput } from "./cashflow-entry-input";
import { cashflowAmountValue, isCashflowDate } from "./cashflow-ui-utils";

interface CashflowQuickEntryProps {
  branchUuid: string;
  saving: boolean;
  onSave: (input: SaveCashflowEntryInput) => Promise<CashflowEntry | null>;
}

/** One-line income/expense form: no category needed (saved as "General"). */
export function CashflowQuickEntry({ branchUuid, saving, onSave }: CashflowQuickEntryProps) {
  const { t } = useTranslation();
  const [direction, setDirection] = useState<CashflowDirection>("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => businessDateInputValue());
  // Stable per draft so a network retry never creates a duplicate entry.
  const [entryUuid, setEntryUuid] = useState(() => createUuid());
  const amountValue = cashflowAmountValue(amount);
  const valid = Boolean(branchUuid && amountValue !== null && isCashflowDate(date));

  async function submit() {
    if (!valid || saving || amountValue === null) return;
    const saved = await onSave(compactCashflowEntryInput({ branchUuid, entryUuid, editing: null, category: null,
      generalLabel: t("cashflow.generalCategory"), direction, date, amount: amountValue, note }));
    if (!saved) return;
    setAmount("");
    setNote("");
    setEntryUuid(createUuid());
  }

  const income = direction === "income";
  return <form className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4"
    aria-label={t("cashflow.quickTitle")} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Zap className="size-4 text-primary" aria-hidden />
        <h2 className="text-base font-semibold">{t("cashflow.quickTitle")}</h2>
        <span className="hidden text-sm text-muted-foreground sm:inline">{t("cashflow.quickHint")}</span>
      </div>
      <div className="flex rounded-lg bg-muted p-1" role="group" aria-label={t("cashflow.directionLabel")}>
        {(["expense", "income"] as const).map((value) => <Button key={value} type="button" size="sm" disabled={saving}
          aria-pressed={direction === value} onClick={() => setDirection(value)}
          variant={direction === value ? "default" : "ghost"}
          className={`min-h-10 gap-1.5 px-4 ${direction === value ? value === "income" ? "bg-success text-success-foreground hover:bg-success/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}>
          {value === "income" ? <ArrowDownLeft className="size-4" aria-hidden /> : <ArrowUpRight className="size-4" aria-hidden />}
          {t(`cashflow.directions.${value}`)}
        </Button>)}
      </div>
    </div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto_auto]">
      <FormattedNumberInput id="cashflow-quick-amount" decimal disabled={saving} value={amount} onValueChange={setAmount}
        placeholder={`${t("cashflow.fields.amount")} (LAK)`} aria-label={t("cashflow.fields.amount")}
        aria-invalid={Boolean(amount && amountValue === null)}
        className={`min-h-11 text-lg font-semibold tabular-nums ${income ? "text-success" : "text-destructive"}`} />
      <Input id="cashflow-quick-note" className="min-h-11" maxLength={2000} disabled={saving} value={note}
        onChange={(event) => setNote(event.target.value)} placeholder={t("cashflow.quickNotePlaceholder")} aria-label={t("cashflow.fields.note")} />
      <Input id="cashflow-quick-date" className="min-h-11 sm:w-40" type="date" required disabled={saving} value={date}
        onChange={(event) => setDate(event.target.value)} aria-label={t("cashflow.fields.date")} />
      <Button type="submit" className="min-h-11 sm:px-6" disabled={!valid || saving}>
        {saving ? <Spinner aria-hidden /> : null}{t("cashflow.quickSave")}
      </Button>
    </div>
  </form>;
}
