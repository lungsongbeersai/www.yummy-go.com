"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Delete, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldTitle } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  appendCartQuantityDigit,
  checkCartQuantity,
  type CartQuantityKeypadKey,
} from "@/lib/pos/cart-quantity";
import type { promotionQuantity } from "../utils";

const QTY_KEYPAD_KEYS = [
  "7", "8", "9",
  "4", "5", "6",
  "1", "2", "3",
  "clear", "0", "delete",
] as const satisfies readonly CartQuantityKeypadKey[];

type QuantityMeta = ReturnType<typeof promotionQuantity>;

// เหมือน CartQuantityDialog (public-pos) แต่ไม่ผูกกับ CartItem — ใช้ตอนยังไม่ใส่ตะกร้า (เลือกจำนวน
// ในแผงสั่งสินค้า) จึงรับ max/quantityMeta ตรงๆ แทนที่จะคำนวณจาก item เพราะ workflow นี้มีอยู่แล้วแบบ
// synchronous (ไม่ต้องดึงสต็อกสดเหมือนตอนแก้จำนวนใน cart) — ขั้นต่ำเท่ากับ qtyStep เสมอในเวิร์กโฟลว์นี้
// (minQty = qtyStep) checkCartQuantity จึงกันขั้นต่ำให้พร้อมกับกันทวีคูณในตัวอยู่แล้ว
export function ProductQuantityDialog({
  maxQty,
  onOpenChange,
  onSubmit,
  open,
  productTitle,
  quantityMeta,
  qty,
}: {
  maxQty: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (qty: number) => void;
  open: boolean;
  productTitle: string;
  quantityMeta: QuantityMeta;
  qty: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-[26px] border-yg-line bg-linear-to-b from-yg-bg2 to-yg-bg font-yg-sans text-yg-ink">
        <ProductQuantityDialogBody
          maxQty={maxQty}
          productTitle={productTitle}
          quantityMeta={quantityMeta}
          qty={qty}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProductQuantityDialogBody({
  maxQty,
  onCancel,
  onSubmit,
  productTitle,
  quantityMeta,
  qty,
}: {
  maxQty: number;
  onCancel: () => void;
  onSubmit: (qty: number) => void;
  productTitle: string;
  quantityMeta: QuantityMeta;
  qty: number;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(String(qty));
  const check = checkCartQuantity(draft, quantityMeta.qtyStep, maxQty);
  const invalid = check.error !== null;
  const helpText = quantityMeta.hasPromotion
    ? t("pos.editQuantityPromoHelp", {
        buy: quantityMeta.saleQty,
        free: quantityMeta.freeQty,
        step: quantityMeta.qtyStep,
      })
    : t("pos.editQuantityHelp", { max: maxQty });
  const errorText =
    check.error === "max"
      ? t("pos.insufficientStockMax", { max: maxQty })
      : check.error === "step"
        ? t("pos.editQuantityInvalidStep", { step: quantityMeta.qtyStep })
        : t("pos.editQuantityInvalid");

  function pressKey(key: CartQuantityKeypadKey) {
    setDraft((current) => appendCartQuantityDigit(current, key, maxQty));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="lao-tone-text font-yg-sans text-lg font-semibold text-yg-ink">
          {t("pos.editQuantity")}
        </DialogTitle>
        <DialogDescription className="lao-tone-text text-yg-muted">
          {productTitle}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-4">
        <Field data-invalid={invalid} className="gap-2">
          <FieldTitle
            id="public-product-quantity-value-label"
            className="text-xs font-extrabold tracking-wide text-yg-faint"
          >
            {t("pos.qty")}
          </FieldTitle>
          <div
            className={cn(
              "rounded-2xl border border-yg-line bg-yg-panel p-4",
              invalid && "border-destructive/60"
            )}
          >
            <output
              role="status"
              aria-atomic="true"
              aria-labelledby="public-product-quantity-value-label"
              aria-live="polite"
              className={cn(
                "font-yg-number block text-right text-4xl font-semibold text-yg-ink tabular-nums",
                invalid && "text-destructive"
              )}
            >
              {draft || "0"}
            </output>
          </div>
          {invalid ? (
            <FieldError className="text-destructive">{errorText}</FieldError>
          ) : (
            <FieldDescription className="text-yg-muted">{helpText}</FieldDescription>
          )}
        </Field>

        <Field className="gap-2">
          <FieldTitle id="public-product-quantity-keypad-label" className="sr-only">
            {t("pos.qty")}
          </FieldTitle>
          <div
            role="group"
            aria-labelledby="public-product-quantity-keypad-label"
            className="grid grid-cols-3 gap-2"
          >
            {QTY_KEYPAD_KEYS.map((key) => {
              const isDelete = key === "delete";
              const isClear = key === "clear";
              const ariaLabel = isDelete
                ? t("pos.backspaceAmount")
                : isClear
                  ? t("actions.clear")
                  : key;

              return (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  aria-label={ariaLabel}
                  title={isDelete || isClear ? ariaLabel : undefined}
                  className={cn(
                    "h-13 w-full touch-manipulation rounded-xl border-yg-line bg-yg-panel text-lg font-bold text-yg-ink tabular-nums hover:bg-yg-panel-hover",
                    isClear && "text-destructive"
                  )}
                  onClick={() => pressKey(key)}
                >
                  {isDelete ? (
                    <Delete aria-hidden="true" />
                  ) : isClear ? (
                    <RotateCcw aria-hidden="true" />
                  ) : (
                    key
                  )}
                </Button>
              );
            })}
          </div>
        </Field>
      </FieldGroup>

      <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl border-yg-line bg-yg-panel text-yg-ink hover:bg-yg-panel-hover hover:text-yg-ink"
          onClick={onCancel}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          type="button"
          className="h-11 rounded-xl bg-yg-accent font-extrabold text-yg-on-accent hover:bg-yg-accent hover:brightness-105"
          disabled={invalid}
          onClick={() => {
            if (check.value !== null) onSubmit(check.value);
          }}
        >
          {t("actions.save")}
        </Button>
      </DialogFooter>
    </>
  );
}
