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
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  appendCartQuantityDigit,
  checkCartQuantity,
  MAX_CART_ITEM_QTY,
  promotionQuantity,
  type CartQuantityKeypadKey,
} from "@/lib/pos/cart-quantity";
import type { CartItem } from "@/services/pos";
import { cartItemTitle, getCartItemQty } from "../utils";

const QTY_KEYPAD_KEYS = [
  "7", "8", "9",
  "4", "5", "6",
  "1", "2", "3",
  "clear", "0", "delete",
] as const satisfies readonly CartQuantityKeypadKey[];

export function CartQuantityDialog({
  item,
  onOpenChange,
  onSubmit,
  open,
  pending,
}: {
  item: CartItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (qty: number) => void;
  open: boolean;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-[26px] border-yg-line bg-linear-to-b from-yg-bg2 to-yg-bg font-yg-sans text-yg-ink">
        {item ? (
          <CartQuantityDialogBody
            item={item}
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CartQuantityDialogBody({
  item,
  onCancel,
  onSubmit,
  pending,
}: {
  item: CartItem;
  onCancel: () => void;
  onSubmit: (qty: number) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const qty = getCartItemQty(item);
  const promotion = promotionQuantity(item.detail, qty);
  const [draft, setDraft] = useState(String(qty));
  const check = checkCartQuantity(draft, promotion.qtyStep, MAX_CART_ITEM_QTY);
  const invalid = check.error !== null;
  const helpText = promotion.hasPromotion
    ? t("pos.editQuantityPromoHelp", {
        buy: promotion.saleQty,
        free: promotion.freeQty,
        step: promotion.qtyStep,
      })
    : t("pos.editQuantityHelp", { max: MAX_CART_ITEM_QTY });
  const errorText =
    check.error === "max"
      ? t("pos.editQuantityMaxExceeded", { max: MAX_CART_ITEM_QTY })
      : check.error === "step"
        ? t("pos.editQuantityInvalidStep", { step: promotion.qtyStep })
        : t("pos.editQuantityInvalid");

  function pressKey(key: CartQuantityKeypadKey) {
    if (pending) return;
    setDraft((current) => appendCartQuantityDigit(current, key, MAX_CART_ITEM_QTY));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="lao-tone-text font-yg-sans text-lg font-semibold text-yg-ink">
          {t("pos.editQuantity")}
        </DialogTitle>
        <DialogDescription className="lao-tone-text text-yg-muted">
          {cartItemTitle(item)}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-4">
        <Field data-invalid={invalid} className="gap-2">
          <FieldTitle
            id="public-cart-quantity-value-label"
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
              aria-labelledby="public-cart-quantity-value-label"
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
          <FieldTitle id="public-cart-quantity-keypad-label" className="sr-only">
            {t("pos.qty")}
          </FieldTitle>
          <div
            role="group"
            aria-labelledby="public-cart-quantity-keypad-label"
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
                  disabled={pending}
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
          disabled={pending}
          onClick={onCancel}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          type="button"
          className="h-11 rounded-xl bg-yg-accent font-extrabold text-yg-on-accent hover:bg-yg-accent hover:brightness-105"
          disabled={pending || invalid}
          onClick={() => {
            if (check.value !== null) onSubmit(check.value);
          }}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {t("actions.save")}
        </Button>
      </DialogFooter>
    </>
  );
}
