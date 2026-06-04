"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  ImageIcon,
  Loader2,
  Minus,
  Plus,
  ReceiptText,
  Send,
  ShoppingBag,
  Trash2,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ProductImageStatus,
  type CartItem,
  type CartOrder,
  type ChangeType,
  type FetchCartStatusRule,
} from "@/services/pos";
import {
  cartGroupTitle,
  cartItemTitle,
  formatMoney,
  getCartItemQty,
  getCartItemStatus,
  getCartItemTotal,
  getCartReceiptTotals,
  getOrderGrandTotal,
  getOrderItemUuid,
  isCanceledCartItem,
  isConfirmableCartItem,
  isEditableCartItem,
  isHexColor,
  isServedCartItem,
  isWaitingStaffConfirmCartItem,
  numeric,
  promotionQuantity,
} from "@/features/public-pos/order/utils";

export function CartSheet({
  open,
  onOpenChange,
  cart,
  statusRule,
  lang,
  loading,
  saving,
  confirming,
  onUpdateQty,
  onDeleteItem,
  onConfirmKitchen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartOrder[];
  statusRule: FetchCartStatusRule | null;
  lang: string;
  loading: boolean;
  saving: boolean;
  confirming: boolean;
  onUpdateQty: (
    orderItemUuid: string,
    changeType: ChangeType,
    changeQty?: number,
  ) => void;
  onDeleteItem: (orderItemUuid: string) => void;
  onConfirmKitchen: () => void;
}) {
  const { t } = useTranslation();
  const receipt = cart[0] ?? null;
  const allItems = cart.flatMap((order) => order.items ?? []);
  const confirmableItems = allItems.filter((item) =>
    isConfirmableCartItem(item, statusRule),
  );
  const waitingStaffItems = allItems.filter(isWaitingStaffConfirmCartItem);
  const kitchenItems = allItems.filter(
    (item) =>
      !isConfirmableCartItem(item, statusRule) &&
      !isWaitingStaffConfirmCartItem(item) &&
      !isServedCartItem(item) &&
      !isCanceledCartItem(item),
  );
  const servedItems = allItems.filter(isServedCartItem);
  const canceledItems = allItems.filter(isCanceledCartItem);
  const total = cart.reduce((sum, order) => sum + getOrderGrandTotal(order), 0);
  const totals = getCartReceiptTotals(cart);
  const invoice = receipt?.order_invoice
    ? `#${receipt.order_invoice}`
    : t("pos.basket");
  const tableName = receipt?.table_name_la || receipt?.table_name_eng || "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-hidden rounded-t-[1.35rem] border-emerald-100 bg-[#f7fcf9] p-0 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2 dark:border-border dark:bg-background"
      >
        <SheetHeader className="border-b border-emerald-100 bg-white/95 p-3 text-left dark:border-border dark:bg-background/95">
          <div className="mb-1 h-1 w-10 self-center rounded-full bg-emerald-100 dark:bg-muted" />
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle className="truncate text-base font-semibold leading-5">
                {invoice}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {tableName ? `${t("pos.table")} ${tableName}` : t("pos.basket")}
              </SheetDescription>
            </div>
            <Badge className="h-6 rounded-full border border-emerald-100 bg-emerald-50 px-2 text-[11px] font-medium text-primary dark:border-border dark:bg-primary/10">
              {allItems.length} {t("pos.cartItems")}
            </Badge>
          </div>
        </SheetHeader>

        <div className="overflow-y-auto px-3 py-2.5">
          {loading ? (
            <div className="grid gap-2">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : null}

          {!loading && !cart.length ? (
            <div className="grid min-h-44 place-items-center text-center">
              <div>
                <ShoppingBag className="mx-auto mb-3 size-10 text-muted-foreground" />
                <p className="font-black">{t("pos.noOrder")}</p>
              </div>
            </div>
          ) : null}

          {confirmableItems.length ? (
            <CartGroup
              title={cartGroupTitle(confirmableItems, t("pos.newOrder"))}
              items={confirmableItems}
              statusRule={statusRule}
              saving={saving}
              lang={lang}
              onUpdateQty={onUpdateQty}
              onDeleteItem={onDeleteItem}
            />
          ) : null}

          {waitingStaffItems.length ? (
            <CartGroup
              title={cartGroupTitle(
                waitingStaffItems,
                t("pos.cartStatusWaitingConfirm"),
              )}
              items={waitingStaffItems}
              statusRule={statusRule}
              saving={saving}
              lang={lang}
              onUpdateQty={onUpdateQty}
              onDeleteItem={onDeleteItem}
            />
          ) : null}

          {kitchenItems.length ? (
            <CartGroup
              title={cartGroupTitle(kitchenItems, t("pos.orderInProgress"))}
              items={kitchenItems}
              statusRule={statusRule}
              saving={saving}
              lang={lang}
              onUpdateQty={onUpdateQty}
              onDeleteItem={onDeleteItem}
            />
          ) : null}

          {servedItems.length ? (
            <CartGroup
              title={cartGroupTitle(servedItems, t("pos.orderServed"))}
              items={servedItems}
              statusRule={statusRule}
              saving={saving}
              lang={lang}
              onUpdateQty={onUpdateQty}
              onDeleteItem={onDeleteItem}
            />
          ) : null}

          {canceledItems.length ? (
            <CartGroup
              title={cartGroupTitle(canceledItems, t("pos.orderCanceled"))}
              items={canceledItems}
              statusRule={statusRule}
              saving={saving}
              lang={lang}
              onUpdateQty={onUpdateQty}
              onDeleteItem={onDeleteItem}
            />
          ) : null}
        </div>

        <SheetFooter className="border-t border-emerald-100 bg-white p-3 dark:border-border dark:bg-background">
          <div className="grid gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/45 p-2.5 text-xs dark:border-border dark:bg-muted/30">
            <CartTotalRow
              label={t("pos.cartSubtotal")}
              value={totals.subtotal}
              lang={lang}
            />
            {totals.itemDiscount > 0 ? (
              <CartTotalRow
                label={t("pos.itemDiscount")}
                value={-totals.itemDiscount}
                lang={lang}
                muted
              />
            ) : null}
            {totals.orderDiscount > 0 ? (
              <CartTotalRow
                label={t("pos.discountTotal")}
                value={-totals.orderDiscount}
                lang={lang}
                muted
              />
            ) : null}
            {totals.service > 0 ? (
              <CartTotalRow
                label={t("pos.serviceCharge")}
                value={totals.service}
                lang={lang}
                muted
              />
            ) : null}
            {totals.vat > 0 ? (
              <CartTotalRow
                label={t("pos.vat")}
                value={totals.vat}
                lang={lang}
                muted
              />
            ) : null}
            <div className="mt-1 flex items-center justify-between border-t border-emerald-100 pt-2 dark:border-border">
              <p className="text-sm font-semibold">{t("common.total")}</p>
              <p className="text-base font-semibold text-primary">
                {formatMoney(total, lang)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block min-w-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-md text-xs"
                    disabled
                  >
                    <ReceiptText />
                    {t("pos.requestBill")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {t("pos.requestBillDevelopmentTooltip")}
              </TooltipContent>
            </Tooltip>
            <Button
              type="button"
              className="h-11 rounded-md text-xs"
              onClick={onConfirmKitchen}
              disabled={!confirmableItems.length || confirming}
            >
              {confirming ? <Loader2 className="animate-spin" /> : <Send />}
              {t("pos.confirmOrderAction")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CartTotalRow({
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
        muted ? "text-muted-foreground" : "",
      )}
    >
      <span>{label}</span>
      <span className="font-medium">{formattedValue}</span>
    </div>
  );
}

function CartGroup({
  title,
  items,
  statusRule,
  saving,
  lang,
  onUpdateQty,
  onDeleteItem,
}: {
  title: string;
  items: CartItem[];
  statusRule: FetchCartStatusRule | null;
  saving: boolean;
  lang: string;
  onUpdateQty: (
    orderItemUuid: string,
    changeType: ChangeType,
    changeQty?: number,
  ) => void;
  onDeleteItem: (orderItemUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2 py-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <Badge className="h-5 rounded-full border border-emerald-100 bg-white px-1.5 py-0 text-[10px] font-medium text-muted-foreground dark:border-border dark:bg-background">
          {items.length}
        </Badge>
      </div>
      {items.map((item, index) => {
        const uuid = getOrderItemUuid(item);
        const qty = getCartItemQty(item);
        const status = getCartItemStatus(item, t);
        const StatusIcon = status.Icon;
        const editableItem = isEditableCartItem(item, statusRule);
        const promotion = promotionQuantity(item.detail, qty);
        const discountAmount = numeric(item.detail?.order_it_discount_amount);
        return (
          <div
            key={uuid || index}
            className={cn(
              "rounded-xl border border-emerald-100 bg-white p-2.5 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background",
              isCanceledCartItem(item)
                ? "border-red-100 bg-red-50/40 dark:border-red-500/30 dark:bg-red-950/15"
                : "",
            )}
          >
            <div className="flex gap-2.5">
              <CartItemMedia item={item} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-4">
                      {cartItemTitle(item)}
                    </p>
                    {item.detail?.size_name ? (
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.detail.size_name}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-primary">
                    {formatMoney(getCartItemTotal(item), lang)}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge
                    className={cn(
                      "h-5 gap-1 rounded-md border px-1.5 py-0 text-[10px] font-medium leading-4",
                      status.className,
                    )}
                  >
                    <StatusIcon className="size-3" />
                    <span>{status.label}</span>
                  </Badge>
                  {promotion.hasPromotion ? (
                    <Badge className="h-5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-200">
                      {t("pos.buyShort")} {promotion.saleQty}{" "}
                      {t("pos.getShort")} {promotion.freeQty}
                      {promotion.totalReceiveQty &&
                      promotion.totalReceiveQty > qty
                        ? ` / ${t("pos.cartPromoReceive", { count: promotion.totalReceiveQty })}`
                        : ""}
                    </Badge>
                  ) : null}
                </div>
                {item.toppings?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.toppings.map((topping, toppingIndex) => (
                      <span
                        key={`${topping.topping_name}-${toppingIndex}`}
                        className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-primary/10 dark:text-primary"
                      >
                        {topping.topping_name}
                        {numeric(topping.topping_line_total) > 0
                          ? ` +${formatMoney(numeric(topping.topping_line_total), lang)}`
                          : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
                {item.detail?.order_it_note ? (
                  <p className="mt-1 line-clamp-1 rounded-md bg-slate-50 px-1.5 py-1 text-xs font-medium text-muted-foreground dark:bg-muted/50">
                    {item.detail.order_it_note}
                  </p>
                ) : null}
                {discountAmount > 0 ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-200">
                    {t("pos.itemDiscount")}: -
                    {formatMoney(discountAmount, lang)}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-3">
                  {editableItem && uuid ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-md"
                        disabled={saving || qty <= promotion.qtyStep}
                        onClick={() =>
                          onUpdateQty(uuid, "DECREASE", promotion.qtyStep)
                        }
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="grid h-10 min-w-9 place-items-center rounded-md border border-emerald-100 px-2 text-sm font-black dark:border-border">
                        {qty}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-md"
                        disabled={saving}
                        onClick={() =>
                          onUpdateQty(uuid, "INCREASE", promotion.qtyStep)
                        }
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge className="h-5 rounded-full border border-emerald-100 bg-white px-1.5 py-0 text-[10px] font-medium text-muted-foreground dark:border-border dark:bg-background">
                      x{qty}
                    </Badge>
                  )}
                  {editableItem && uuid ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-md"
                      disabled={saving}
                      onClick={() => onDeleteItem(uuid)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
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
      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-emerald-50 dark:bg-muted">
        <Image
          src={imageUrl}
          alt={cartItemTitle(item)}
          fill
          loading="lazy"
          quality={60}
          sizes="64px"
          className="object-cover"
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
        <Utensils className="size-6 text-background/85" />
      </div>
    );
  }

  return (
    <div className="grid size-14 shrink-0 place-items-center rounded-md bg-emerald-50 text-muted-foreground dark:bg-muted">
      <ImageIcon className="size-6" />
    </div>
  );
}
