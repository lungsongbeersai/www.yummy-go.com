"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ImageIcon,
  MessageSquareText,
  Minus,
  Plus,
  Trash2,
  Utensils,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductImageStatus } from "@/config/pos-constants";
import type { CartItem, ChangeType, FetchCartStatusRule } from "@/services/pos";
import {
  cartItemTitle,
  formatMoney,
  getCartItemQty,
  getCartItemStatus,
  getCartItemTotal,
  getOrderItemUuid,
  isCanceledCartItem,
  isEditableCartItem,
  isHexColor,
  numeric,
  promotionQuantity,
} from "../utils";

export function CartTotalRow({
  label,
  value,
  lang,
  muted = false,
}: {
  label: string;
  value: number;
  lang: string;
  muted?: boolean;
}) {
  if (!Number.isFinite(value) || value === 0) return null;
  const formattedValue =
    value < 0
      ? `-${formatMoney(Math.abs(value), lang)}`
      : formatMoney(value, lang);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        muted ? "text-yg-muted" : "text-yg-ink"
      )}
    >
      <span>{label}</span>
      <span className="font-medium tabular-nums">{formattedValue}</span>
    </div>
  );
}

export function CartGroup({
  groupKey,
  title,
  items,
  statusRule,
  saving,
  lang,
  onUpdateQty,
  onDeleteItem,
  onOpenNote,
  onOpenQuantity,
}: {
  groupKey: string;
  title: string;
  items: CartItem[];
  statusRule: FetchCartStatusRule | null;
  saving: boolean;
  lang: string;
  onUpdateQty: (
    orderItemUuid: string,
    changeType: ChangeType,
    changeQty?: number
  ) => void;
  onDeleteItem: (orderItemUuid: string) => void;
  onOpenNote: (item: CartItem) => void;
  onOpenQuantity: (item: CartItem) => void;
}) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<{
    uuid: string;
    title: string;
  } | null>(null);

  return (
    <section
      className="grid gap-2 py-1.5"
      aria-labelledby={`public-cart-group-${groupKey}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id={`public-cart-group-${groupKey}`}
          className="text-sm font-semibold"
        >
          {title}
        </h3>
        <Badge
          variant="secondary"
          className="h-5 rounded-full px-1.5 py-0 text-[10px]"
        >
          {items.length}
        </Badge>
      </div>
      {items.map((item, index) => (
        <CartItemCard
          key={getOrderItemUuid(item) || index}
          groupTitle={title}
          item={item}
          lang={lang}
          saving={saving}
          statusRule={statusRule}
          onDeleteRequest={setDeleteTarget}
          onOpenNote={onOpenNote}
          onOpenQuantity={onOpenQuantity}
          onUpdateQty={onUpdateQty}
        />
      ))}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("pos.deleteItemConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pos.deleteItemDescription", {
                name: deleteTarget?.title ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={() => {
                if (deleteTarget) onDeleteItem(deleteTarget.uuid);
                setDeleteTarget(null);
              }}
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function CartItemCard({
  groupTitle,
  item,
  lang,
  onDeleteRequest,
  onOpenNote,
  onOpenQuantity,
  onUpdateQty,
  saving,
  statusRule,
}: {
  groupTitle: string;
  item: CartItem;
  lang: string;
  onDeleteRequest: (target: { uuid: string; title: string }) => void;
  onOpenNote: (item: CartItem) => void;
  onOpenQuantity: (item: CartItem) => void;
  onUpdateQty: (
    orderItemUuid: string,
    changeType: ChangeType,
    changeQty?: number
  ) => void;
  saving: boolean;
  statusRule: FetchCartStatusRule | null;
}) {
  const { t } = useTranslation();
  const uuid = getOrderItemUuid(item);
  const qty = getCartItemQty(item);
  const titleText = cartItemTitle(item);
  const sizeName = item.detail?.size_name?.trim() ?? "";
  const showSizeName =
    Boolean(sizeName) &&
    !titleText.toLocaleLowerCase().includes(sizeName.toLocaleLowerCase());
  const itemTotal = getCartItemTotal(item);
  const status = getCartItemStatus(item, t);
  const StatusIcon = status.Icon;
  const editableItem = isEditableCartItem(item, statusRule);
  const promotion = promotionQuantity(item.detail, qty);
  const discountAmount = numeric(item.detail?.order_it_discount_amount);
  const showItemStatus =
    status.label.trim().toLocaleLowerCase() !==
    groupTitle.trim().toLocaleLowerCase();

  return (
    <div
      className={cn(
        "rounded-2xl border border-yg-line bg-yg-panel p-3",
        isCanceledCartItem(item) ? "border-destructive/20 bg-destructive/5" : ""
      )}
    >
      <div className="flex gap-2.5">
        <CartItemMedia item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="lao-tone-text line-clamp-2 text-sm font-semibold">
                {titleText}
              </p>
              {showSizeName ? (
                <p className="text-xs font-medium text-yg-muted">{sizeName}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-yg-number text-[17px] font-semibold text-yg-accent-strong tabular-nums">
                {formatMoney(itemTotal, lang)}
              </p>
              {qty > 1 ? (
                <p className="text-[10px] tabular-nums text-yg-faint">
                  {qty} × {formatMoney(itemTotal / qty, lang)}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {showItemStatus ? (
              <Badge
                className={cn(
                  "h-5 gap-1 rounded-md border px-1.5 py-0 text-[10px] font-medium leading-4",
                  status.className
                )}
              >
                <StatusIcon aria-hidden="true" />
                <span>{status.label}</span>
              </Badge>
            ) : null}
            {promotion.hasPromotion ? (
              <Badge className="h-5 rounded-md border border-yg-accent-line bg-yg-accent-soft px-1.5 py-0 text-[10px] font-bold text-yg-accent-strong">
                {t("pos.buyShort")} {promotion.saleQty}{" "}
                {t("pos.getShort")} {promotion.freeQty}
                {promotion.totalReceiveQty && promotion.totalReceiveQty > qty
                  ? ` / ${t("pos.cartPromoReceive", {
                      count: promotion.totalReceiveQty,
                    })}`
                  : ""}
              </Badge>
            ) : null}
          </div>
          {item.toppings?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.toppings.map((topping, toppingIndex) => {
                const toppingQty = numeric(topping.topping_qty);
                return (
                  <Badge
                    key={`${topping.topping_name}-${toppingIndex}`}
                    variant="secondary"
                    className="h-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  >
                    {topping.topping_name}
                    {toppingQty > 0 ? ` x${toppingQty}` : ""}
                    {numeric(topping.topping_line_total) > 0
                      ? ` +${formatMoney(numeric(topping.topping_line_total), lang)}`
                      : ""}
                  </Badge>
                );
              })}
            </div>
          ) : null}
          {item.detail?.order_it_note ? (
            <p className="mt-1 line-clamp-2 rounded-lg bg-yg-panel2 px-2 py-1 text-xs font-medium text-yg-muted">
              {item.detail.order_it_note}
            </p>
          ) : null}
          {discountAmount > 0 ? (
            <p className="mt-1 text-[11px] font-medium text-yg-accent-strong">
              {t("pos.itemDiscount")}: -{formatMoney(discountAmount, lang)}
            </p>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-3">
            {editableItem && uuid ? (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("pos.decreaseQuantity")}
                  className="h-11 w-11 rounded-md"
                  disabled={saving || qty <= promotion.qtyStep}
                  onClick={() => onUpdateQty(uuid, "DECREASE", promotion.qtyStep)}
                >
                  <Minus aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t("pos.editQuantity")}
                  aria-live="polite"
                  className="h-10 min-w-9 rounded-lg border-yg-line bg-yg-bg2 px-2 font-yg-mono text-sm font-semibold text-yg-ink tabular-nums hover:bg-yg-panel-hover"
                  disabled={saving}
                  onClick={() => onOpenQuantity(item)}
                >
                  {qty}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("pos.increaseQuantity")}
                  className="h-11 w-11 rounded-md"
                  disabled={saving}
                  onClick={() => onUpdateQty(uuid, "INCREASE", promotion.qtyStep)}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <Badge
                variant="secondary"
                className="h-5 rounded-full px-1.5 py-0 text-[10px] font-medium"
              >
                {t("pos.quantityValue", { count: qty })}
              </Badge>
            )}
            {editableItem && uuid ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-xl text-yg-accent-strong hover:bg-yg-panel-hover"
                  disabled={saving}
                  aria-label={t("pos.editNote")}
                  title={t("pos.editNote")}
                  onClick={() => onOpenNote(item)}
                >
                  <MessageSquareText aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-md"
                  disabled={saving}
                  aria-label={t("pos.deleteItem")}
                  title={t("pos.deleteItem")}
                  onClick={() => onDeleteRequest({ uuid, title: titleText })}
                >
                  <Trash2 className="text-destructive" aria-hidden="true" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CartItemMedia({ item }: { item: CartItem }) {
  const imageUrl =
    item.prod_status_imge === ProductImageStatus.IMAGE &&
    item.prod_image?.startsWith("http")
      ? item.prod_image
      : "";
  const colorSwatch =
    item.prod_status_imge === ProductImageStatus.COLOR &&
    isHexColor(item.prod_image)
      ? item.prod_image
      : "";

  if (imageUrl) {
    return (
      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-yg-line">
        <Image
          src={imageUrl}
          alt={cartItemTitle(item)}
          fill
          loading="lazy"
          quality={60}
          sizes="64px"
          className="object-contain"
        />
      </div>
    );
  }

  if (colorSwatch) {
    return (
      <div
        className="grid size-14 shrink-0 place-items-center rounded-md"
        style={{ backgroundColor: colorSwatch }}
      >
        <Utensils className="size-6 text-background/85" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="grid size-14 shrink-0 place-items-center rounded-xl border border-yg-line bg-yg-panel2 text-yg-faint">
      <ImageIcon className="size-6" aria-hidden="true" />
    </div>
  );
}
