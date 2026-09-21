"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// สำหรับปรับจำนวนฝาก/เบิกด้วยปุ่ม +/- แทนการพิมพ์เลขเอง — ห้ามน้อยกว่า 1 และห้ามเกิน maxQty
export function DepositQtyStepper({
  disabled,
  invalid,
  maxQty,
  minQty = 1,
  onChange,
  qty
}: {
  disabled?: boolean;
  invalid?: boolean;
  maxQty: number;
  minQty?: number;
  onChange: (qty: number) => void;
  qty: number;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center overflow-hidden rounded-full border shadow-sm",
        invalid ? "border-destructive bg-destructive/5" : "border-primary/50 bg-primary/5"
      )}
    >
      <Button
        aria-label={`${t("deposit.qty")} -`}
        type="button"
        size="icon-sm"
        variant="ghost"
        className="size-8 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
        disabled={disabled || qty <= minQty}
        onClick={() => onChange(Math.max(qty - 1, minQty))}
      >
        <Minus className="size-3.5" />
      </Button>
      <span className="min-w-8 px-1 text-center text-sm font-black tabular-nums text-foreground">{qty}</span>
      <Button
        aria-label={`${t("deposit.qty")} +`}
        type="button"
        size="icon-sm"
        variant="ghost"
        className="size-8 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
        disabled={disabled || qty >= maxQty}
        onClick={() => onChange(Math.min(qty + 1, maxQty))}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
