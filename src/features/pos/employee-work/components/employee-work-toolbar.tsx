"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money } from "@/lib/format";
import type { EmployeeWorkParams, EmployeeWorkResponse } from "@/services/pos";
import { EMPLOYEE_WORK_KITCHEN, EMPLOYEE_WORK_PAYMENT, employeeWorkKitchenLabel, employeeWorkPaymentLabels } from "@/features/pos/employee-work/employee-work-format";

interface EmployeeWorkToolbarProps {
  response: EmployeeWorkResponse | null;
  params: EmployeeWorkParams;
  search: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onFilterChange: (params: EmployeeWorkParams) => void;
}

export function EmployeeWorkToolbar({ response, params, search, onSearchChange, onSearch, onFilterChange }: EmployeeWorkToolbarProps) {
  const { t } = useTranslation();
  const l = (key: string) => t(`employeeWork.${key}`);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Number((params.kitchen_status ?? "all") !== "all") + Number((params.payment_status ?? "all") !== "all");
  const amount = !response ? "—" : response.summary.total_amount === null ? l("unknown") : money(response.summary.total_amount);

  return <div className="grid shrink-0 gap-3 border-b border-border px-3 pb-3 sm:px-5">
    <form className="flex min-w-0 gap-2" onSubmit={event => { event.preventDefault(); onSearch(); }}>
      <div className="relative min-w-0 flex-1"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" aria-label={l("search")} placeholder={l("searchShort")} value={search} maxLength={120} className="min-h-11 min-w-0 pl-9" onChange={event => onSearchChange(event.target.value)} /></div>
      <Button type="submit" variant="outline" className="size-11 shrink-0" aria-label={t("actions.search")}><Search className="size-4" /></Button>
      <Button type="button" variant="outline" className="relative size-11 shrink-0" aria-label={`${l("filters")}${activeFilters ? ` (${activeFilters})` : ""}`} aria-expanded={filtersOpen} aria-controls="employee-work-filters" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal className="size-4" />{activeFilters ? <span aria-hidden="true" className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{activeFilters}</span> : null}</Button>
    </form>
    {filtersOpen ? <div id="employee-work-filters" className="grid grid-cols-2 gap-2">
      <div className="grid gap-1"><Label htmlFor="employee-work-kitchen" className="text-xs">{l("kitchenShort")}</Label><Select value={params.kitchen_status ?? "all"} onValueChange={value => { const status = EMPLOYEE_WORK_KITCHEN.find(option => option === value); if (status) onFilterChange({ kitchen_status: status, page: 1 }); }}><SelectTrigger id="employee-work-kitchen" aria-label={l("kitchen")} className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent className="font-lao">{EMPLOYEE_WORK_KITCHEN.map(status => <SelectItem key={status} value={status} className="min-h-11">{status === "all" ? t("common.all") : l(employeeWorkKitchenLabel(status))}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-1"><Label htmlFor="employee-work-payment" className="text-xs">{l("settlementShort")}</Label><Select value={params.payment_status ?? "all"} onValueChange={value => { const status = EMPLOYEE_WORK_PAYMENT.find(option => option === value); if (status) onFilterChange({ payment_status: status, page: 1 }); }}><SelectTrigger id="employee-work-payment" aria-label={l("settlement")} className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent className="font-lao">{EMPLOYEE_WORK_PAYMENT.map(status => <SelectItem key={status} value={status} className="min-h-11">{status === "all" ? t("common.all") : employeeWorkPaymentLabels(status).map(l).join(" · ")}</SelectItem>)}</SelectContent></Select></div>
    </div> : null}
    <div className="grid grid-cols-[1.5fr_1fr_1fr] divide-x divide-border rounded-lg bg-muted/35 py-2.5">
      {[["totalShort", amount], ["itemsShort", response ? String(response.summary.item_count) : "—"], ["unclosedShort", response ? String(response.summary.open_count) : "—"]].map(([key, value], index) => <div key={key} className="min-w-0 px-3"><p className="text-xs text-muted-foreground">{l(key)}</p><p className={index === 0 ? "mt-0.5 break-words text-base font-semibold tabular-nums sm:text-lg" : "mt-0.5 text-base font-semibold tabular-nums"}>{value}</p></div>)}
    </div>
  </div>;
}
