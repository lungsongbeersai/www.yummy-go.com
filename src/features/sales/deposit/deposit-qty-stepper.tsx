"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DepositQtyStepperProps {
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  maxQty: number;
  minQty?: number;
  onChange: (qty: number) => void;
  onRawChange?: (qty: string) => void;
  rawValue?: string;
  qty: number;
}

export function DepositQtyStepper({ disabled, invalid, label, maxQty, minQty = 0.001, onChange, onRawChange, rawValue, qty }: DepositQtyStepperProps) {
  const { t } = useTranslation();
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return <div className={cn("flex h-10 shrink-0 items-center rounded-md border bg-background", invalid ? "border-destructive" : "border-input")}>
    <Button type="button" variant="ghost" size="icon" className="size-9 rounded-none" disabled={disabled || qty <= minQty}
      aria-label={(label || t("deposit.qty")) + " -"} onClick={() => onChange(round(Math.max(qty - 1, minQty)))}><Minus className="size-3.5" /></Button>
    <Input type="number" inputMode="decimal" min={minQty} max={maxQty} step="0.001" value={rawValue ?? (qty || "")} disabled={disabled}
      aria-label={label || t("deposit.qty")} aria-invalid={invalid} className="h-9 w-16 appearance-none rounded-none border-0 bg-transparent px-1 text-center font-medium tabular-nums shadow-none focus-visible:ring-1 sm:w-18 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      onChange={(event) => onRawChange ? onRawChange(event.target.value) : onChange(event.target.value === "" ? 0 : Number(event.target.value))} />
    <Button type="button" variant="ghost" size="icon" className="size-9 rounded-none" disabled={disabled || qty >= maxQty}
      aria-label={(label || t("deposit.qty")) + " +"} onClick={() => onChange(round(Math.min(qty + 1, maxQty)))}><Plus className="size-3.5" /></Button>
  </div>;
}
