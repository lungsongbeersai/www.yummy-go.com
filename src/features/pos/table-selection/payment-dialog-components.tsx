"use client";

import type { PointerEvent } from "react";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PaymentStat({
  hero,
  label,
  strong,
  value,
}: {
  hero?: boolean;
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-1.5 sm:p-3",
        strong && "border-primary/40",
        hero && "border-primary bg-primary text-primary-foreground",
      )}
    >
      <p
        className={cn(
          "truncate text-xs font-semibold text-muted-foreground",
          hero && "text-primary-foreground/80",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate font-black tabular-nums sm:mt-1",
          hero
            ? "text-lg sm:text-2xl lg:text-4xl"
            : "text-sm min-[430px]:text-base sm:text-lg lg:text-xl",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function TenderRow({
  active,
  equivalent,
  label,
  onSelect,
  value,
}: {
  active: boolean;
  equivalent: string;
  label: string;
  onSelect: () => void;
  value: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      className={cn(
        "h-auto min-h-12 w-full justify-between px-3 py-2 text-left sm:min-h-14",
        active && "border-primary/70 ring-2 ring-primary/20",
      )}
      onClick={onSelect}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {equivalent}
        </span>
      </span>
      <span className="shrink-0 font-black tabular-nums">{value}</span>
    </Button>
  );
}

export function PosNumpad({
  allowDecimal,
  backspaceLabel,
  clearLabel,
  confirmLabel,
  exactLabel,
  onBackspace,
  onClear,
  onConfirm,
  onDecimal,
  onDigit,
  onExact,
  processing,
}: {
  allowDecimal: boolean;
  backspaceLabel: string;
  clearLabel: string;
  confirmLabel: string;
  exactLabel: string;
  onBackspace: () => void;
  onClear: () => void;
  onConfirm: () => void;
  onDecimal: () => void;
  onDigit: (value: string) => void;
  onExact: () => void;
  processing: boolean;
}) {
  const keepAmountFocus = (event: PointerEvent<HTMLButtonElement>) =>
    event.preventDefault();
  const numberClass =
    "h-full min-h-9 min-w-0 rounded-md text-lg font-black tabular-nums min-[430px]:min-h-10 sm:min-h-11 sm:text-2xl";
  const actionClass =
    "h-full min-h-9 min-w-0 rounded-md px-2 text-xs font-black min-[430px]:min-h-10 sm:min-h-11 sm:text-sm";

  return (
    <div className="grid h-full min-h-0 grid-cols-4 grid-rows-4 gap-1.5 min-[430px]:gap-2">
      {["7", "8", "9"].map((value) => (
        <Button
          key={value}
          type="button"
          variant="outline"
          className={numberClass}
          onPointerDown={keepAmountFocus}
          onClick={() => onDigit(value)}
        >
          {value}
        </Button>
      ))}
      <Button
        type="button"
        variant="secondary"
        className={actionClass}
        aria-label={backspaceLabel}
        onPointerDown={keepAmountFocus}
        onClick={onBackspace}
      >
        <Delete />
      </Button>

      {["4", "5", "6"].map((value) => (
        <Button
          key={value}
          type="button"
          variant="outline"
          className={numberClass}
          onPointerDown={keepAmountFocus}
          onClick={() => onDigit(value)}
        >
          {value}
        </Button>
      ))}
      <Button
        type="button"
        variant="secondary"
        className={actionClass}
        onPointerDown={keepAmountFocus}
        onClick={onClear}
      >
        <span className="truncate">{clearLabel}</span>
      </Button>

      {["1", "2", "3"].map((value) => (
        <Button
          key={value}
          type="button"
          variant="outline"
          className={numberClass}
          onPointerDown={keepAmountFocus}
          onClick={() => onDigit(value)}
        >
          {value}
        </Button>
      ))}
      <Button
        type="button"
        variant="secondary"
        className={actionClass}
        onPointerDown={keepAmountFocus}
        onClick={onExact}
      >
        <span className="truncate">{exactLabel}</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        className={numberClass}
        onPointerDown={keepAmountFocus}
        onClick={() => onDigit("00")}
      >
        00
      </Button>
      <Button
        type="button"
        variant="outline"
        className={numberClass}
        onPointerDown={keepAmountFocus}
        onClick={() => onDigit("0")}
      >
        0
      </Button>
      <Button
        type="button"
        variant="outline"
        className={numberClass}
        disabled={!allowDecimal}
        onPointerDown={keepAmountFocus}
        onClick={onDecimal}
      >
        .
      </Button>
      <Button
        type="button"
        className={actionClass}
        disabled={processing}
        onPointerDown={keepAmountFocus}
        onClick={onConfirm}
      >
        <span className="truncate">{confirmLabel}</span>
      </Button>
    </div>
  );
}
