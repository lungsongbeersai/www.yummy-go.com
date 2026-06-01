"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Ban, BadgePercent, ChefHat, ClipboardCheck, Gift, Minus, MoreVertical, Pencil, Plus, ShoppingBag, StickyNote, Tag, Trash2, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/services/pos";
import type { CartItemAction, CartTab } from "./types";
import { cartItemActionUuid, cartItemDisplayName, cartItemMedia, cartItemName, cartItemQty, cartItemStatus, cartItemTotal, cartItemUuid, differentNumber, formatPlainValue, formatPositiveMoneyValue, formatQuantityValue, formatRate, isServedCartItem, optionalBoolean, optionalNumber, optionalString, positiveNumber, type CartItemMedia } from "./utils";

export function CartTabTrigger({
  active,
  count,
  label,
  value
}: {
  active: boolean;
  count: number;
  label: string;
  value: CartTab;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-full min-w-0 gap-1.5 rounded-lg px-2.5 text-[13px] font-black text-white/80 transition-colors data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
    >
      <span className="min-w-0 truncate">{label}</span>
      <Badge
        className={cn(
          "h-6 shrink-0 rounded-full border-transparent px-2 text-xs font-black",
          active ? "bg-primary/10 text-primary" : "bg-white/15 text-white"
        )}
      >
        {count}
      </Badge>
    </TabsTrigger>
  );
}

export function CartTabItems({
  actingItemUuid,
  actionDisabled,
  canSplitItem,
  canConfirmKitchenItem,
  editable = false,
  items,
  onChangeQty,
  onConfirmKitchen,
  onConfirmServed,
  onEditNote,
  onItemDiscount,
  onOpenItemAction,
  onToggleSplitItem,
  splitSelectionDisabled = false,
  splitSelectedItemUuids,
  updatingItemUuid
}: {
  actingItemUuid: string | null;
  actionDisabled: boolean;
  canSplitItem?: (item: CartItem) => boolean;
  canConfirmKitchenItem: (item: CartItem) => boolean;
  editable?: boolean;
  items: CartItem[];
  onChangeQty: (item: CartItem, change: 1 | -1) => void;
  onConfirmKitchen: (item: CartItem) => void;
  onConfirmServed: (item: CartItem) => void;
  onEditNote: (item: CartItem) => void;
  onItemDiscount: (item: CartItem) => void;
  onOpenItemAction: (action: CartItemAction, item: CartItem) => void;
  onToggleSplitItem?: (item: CartItem) => void;
  splitSelectionDisabled?: boolean;
  splitSelectedItemUuids?: Set<string>;
  updatingItemUuid: string | null;
}) {
  if (!items.length) return <CartPanelEmpty />;

  return (
    <div className="flex min-h-full flex-col bg-background">
      {items.map((item, index) => {
        const itemUuid = cartItemActionUuid(item);
        const splitEligible = canSplitItem ? canSplitItem(item) : false;

        return (
          <CartItemRow
            key={String(item.order_item_uuid ?? item.order_it_uuid ?? item.prod_uuid ?? item.product_uuid ?? index)}
            editable={editable}
            item={item}
            actionDisabled={actionDisabled}
            acting={itemUuid === actingItemUuid}
            canConfirmKitchen={canConfirmKitchenItem(item)}
            splitEligible={splitEligible}
            splitSelectionDisabled={splitSelectionDisabled}
            splitSelected={splitEligible && Boolean(itemUuid && splitSelectedItemUuids?.has(itemUuid))}
            updating={cartItemUuid(item) === updatingItemUuid}
            onChangeQty={onChangeQty}
            onConfirmKitchen={onConfirmKitchen}
            onConfirmServed={onConfirmServed}
            onEditNote={onEditNote}
            onItemDiscount={onItemDiscount}
            onOpenItemAction={onOpenItemAction}
            onToggleSplitItem={onToggleSplitItem}
          />
        );
      })}
    </div>
  );
}

function CartPanelEmpty() {
  const { t } = useTranslation();

  return (
    <Empty className="min-h-[240px] flex-1 border-0 bg-background p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-16 rounded-full bg-primary/10 text-primary">
          <ShoppingBag />
        </EmptyMedia>
        <EmptyTitle className="text-sm font-black text-muted-foreground">{t("pos.noOrder")}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

function CartItemRow({
  acting,
  actionDisabled,
  canConfirmKitchen,
  editable,
  item,
  onChangeQty,
  onConfirmKitchen,
  onConfirmServed,
  onEditNote,
  onItemDiscount,
  onOpenItemAction,
  onToggleSplitItem,
  splitEligible,
  splitSelectionDisabled,
  splitSelected,
  updating
}: {
  acting: boolean;
  actionDisabled: boolean;
  canConfirmKitchen: boolean;
  editable: boolean;
  item: CartItem;
  onChangeQty: (item: CartItem, change: 1 | -1) => void;
  onConfirmKitchen: (item: CartItem) => void;
  onConfirmServed: (item: CartItem) => void;
  onEditNote: (item: CartItem) => void;
  onItemDiscount: (item: CartItem) => void;
  onOpenItemAction: (action: CartItemAction, item: CartItem) => void;
  onToggleSplitItem?: (item: CartItem) => void;
  splitEligible: boolean;
  splitSelectionDisabled?: boolean;
  splitSelected?: boolean;
  updating: boolean;
}) {
  const { t } = useTranslation();
  const detail = item.detail;
  const qty = cartItemQty(item);
  const total = cartItemTotal(item);
  const rawTitle = cartItemName(item);
  const media = cartItemMedia(item);
  const statusText = optionalString(detail?.order_it_status_text);
  const statusValue = cartItemStatus(item);
  const itemUuid = cartItemActionUuid(item);
  const affectsTotal = optionalBoolean(detail?.affects_total);
  const orderQty = optionalNumber(detail?.order_it_qty, item.qty, item.quantity, item.item_qty);
  const promoSaleQty = positiveNumber(detail?.order_it_promo_sale_qty);
  const promoFreeQty = positiveNumber(detail?.order_it_promo_free_qty);
  const totalReceiveQty = optionalNumber(detail?.total_receive_qty);
  const saleQty = optionalNumber(detail?.sale_qty);
  const freeQty = positiveNumber(detail?.free_qty);
  const unitPrice = optionalNumber(detail?.unit_price, item.price, item.prod_price, item.product_price);
  const baseLineTotal = optionalNumber(detail?.base_line_total);
  const toppingLineTotal = positiveNumber(detail?.topping_line_total);
  const grossTotal = optionalNumber(detail?.gross_total);
  const discountAmount = positiveNumber(detail?.order_it_discount_amount);
  const discountValue = positiveNumber(detail?.order_it_discount_value);
  const discountType = optionalString(detail?.order_it_discount_type);
  const note = optionalString(detail?.order_it_note);
  const sizeName = optionalString(detail?.size_name);
  const title = cartItemDisplayName(rawTitle, sizeName);
  const toppings = item.toppings ?? [];
  const hasPromo = promoSaleQty !== null || promoFreeQty !== null || freeQty !== null;
  const hasDiscount = discountAmount !== null || discountValue !== null || Boolean(optionalString(detail?.order_it_discount_type));
  const baseWithToppingTotal = baseLineTotal !== null || toppingLineTotal !== null ? (baseLineTotal ?? 0) + (toppingLineTotal ?? 0) : null;
  const originalTotal = [grossTotal, baseWithToppingTotal, baseLineTotal].find((value) => value !== null && value > total) ?? null;
  const priceQty = orderQty ?? qty;
  const priceLineTotal = originalTotal ?? grossTotal ?? baseWithToppingTotal ?? baseLineTotal ?? (unitPrice !== null ? unitPrice * priceQty : null) ?? total;
  const displayUnitPrice = priceQty > 0 && priceLineTotal !== null ? priceLineTotal / priceQty : unitPrice;
  const promoBuyQty = positiveNumber(saleQty, promoSaleQty);
  const promoFreeDisplayQty = positiveNumber(freeQty, promoFreeQty);
  const promoReceiveQty = positiveNumber(totalReceiveQty);
  const discountLabel =
    discountValue !== null
      ? discountType === "PCT"
        ? `${formatRate(discountValue)}%`
        : money(discountValue)
      : formatPositiveMoneyValue(discountAmount);
  const hasQuantitySummary =
    differentNumber(totalReceiveQty, orderQty) ||
    differentNumber(saleQty, orderQty) ||
    promoSaleQty !== null ||
    promoFreeQty !== null ||
    freeQty !== null;
  const hasDetailContent = Boolean(
    displayUnitPrice !== null ||
    originalTotal !== null ||
    hasPromo ||
    hasQuantitySummary ||
    hasDiscount ||
    affectsTotal === false ||
    toppings.length ||
    toppingLineTotal !== null ||
    discountAmount !== null ||
    note
  );
  const canDelete = statusValue === 1;
  const canCancel = !editable && statusValue !== 0 && statusValue !== 1;
  const canConfirmServed = !editable && statusValue !== 0 && statusValue !== 1 && !isServedCartItem(item);
  const splitSelectable = Boolean(splitEligible && itemUuid && onToggleSplitItem);
  const splitEnabled = splitSelectable && !splitSelectionDisabled;

  function toggleSplitSelection() {
    if (!splitEnabled) return;
    onToggleSplitItem?.(item);
  }

  return (
    <div
      className={cn(
        "border-b border-border/80 bg-background px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/20 sm:px-4",
        splitSelectable && !splitEnabled && "cursor-not-allowed opacity-60",
        splitSelected && "border-l-4 border-l-primary bg-primary/5 hover:bg-primary/10"
      )}
    >
      <div
        className={cn(
          "grid min-w-0 gap-2.5",
          splitSelectable
            ? "grid-cols-[44px_44px_minmax(0,1fr)] sm:grid-cols-[44px_48px_minmax(0,1fr)]"
            : "grid-cols-[44px_minmax(0,1fr)] sm:grid-cols-[48px_minmax(0,1fr)]"
        )}
      >
        {splitSelectable ? (
          <label
            className={cn(
              "flex size-11 shrink-0 items-start justify-center pt-0.5",
              splitEnabled ? "cursor-pointer" : "cursor-not-allowed"
            )}
          >
            <Checkbox
              aria-label={t("common.selectRow", { name: title })}
              checked={Boolean(splitSelected)}
              disabled={!splitEnabled}
              className="mt-0.5 size-5 rounded-md border-primary/50 bg-background shadow-sm"
              onChange={toggleSplitSelection}
            />
          </label>
        ) : null}
        <CartProductMedia media={media} title={title} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <p className="min-w-0 break-words text-[15px] font-black leading-5 text-foreground">{title}</p>
                {statusText ? (
                  <Badge className="h-6 rounded-md border-transparent bg-secondary px-2 text-[11px] font-black text-secondary-foreground shadow-none">{statusText}</Badge>
                ) : statusValue !== null ? (
                  <Badge className="h-6 rounded-md px-2 text-[11px] font-black shadow-none">{formatPlainValue(statusValue)}</Badge>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <p className="max-w-[112px] truncate text-right text-[15px] font-black leading-5 text-foreground tabular-nums">{money(total)}</p>
              <CartItemActionMenu
                canCancel={canCancel}
                canDelete={canDelete}
                canConfirmKitchen={editable && statusValue === 1}
                confirmKitchenDisabled={!canConfirmKitchen || actionDisabled}
                canConfirmServed={canConfirmServed}
                disabled={actionDisabled}
                itemUuid={itemUuid}
                pending={acting}
                onCancel={() => onOpenItemAction("cancel", item)}
                onConfirmKitchen={() => onConfirmKitchen(item)}
                onConfirmServed={() => onConfirmServed(item)}
                onDelete={() => onOpenItemAction("delete", item)}
                onEditNote={() => onEditNote(item)}
                onItemDiscount={() => onItemDiscount(item)}
              />
            </div>
          </div>

          {hasDetailContent ? (
            <div className="mt-1.5 grid gap-0.5">
              {displayUnitPrice !== null ? (
                <CartDetailRow
                  icon={<Tag />}
                  tone="price"
                  right={originalTotal !== null ? <span className="line-through opacity-70">{money(originalTotal)}</span> : null}
                >
                  <span className="tabular-nums">
                    {formatQuantityValue(priceQty)} x {money(displayUnitPrice)}
                  </span>
                </CartDetailRow>
              ) : null}

              {hasPromo ? (
                <CartPromoBlock
                  buyQty={promoBuyQty}
                  freeQty={promoFreeDisplayQty}
                  receiveQty={promoReceiveQty}
                />
              ) : null}

              {!hasPromo && hasQuantitySummary ? <CartQuantitySummary saleQty={saleQty} totalReceiveQty={totalReceiveQty} /> : null}

              {hasDiscount && discountLabel ? (
                <CartDetailRow
                  icon={<BadgePercent />}
                  tone="discount"
                  right={discountAmount !== null ? `-${money(discountAmount)}` : null}
                >
                  {discountLabel}
                </CartDetailRow>
              ) : null}

              {affectsTotal === false ? <CartDetailRow tone="muted">{t("pos.affectsTotal")}: {t("pos.no")}</CartDetailRow> : null}
              {toppings.length || toppingLineTotal !== null ? <CartToppingsList toppingTotal={toppingLineTotal} toppings={toppings} /> : null}
              {note ? <CartNote text={note} /> : null}
            </div>
          ) : null}

          <div className="mt-2 flex min-w-0 justify-end">
            {editable ? (
              <CartQuantityStepper
                qty={qty}
                updating={updating}
                onDecrease={() => onChangeQty(item, -1)}
                onIncrease={() => onChangeQty(item, 1)}
              />
            ) : (
              <CartQuantityBadge qty={qty} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type CartDetailTone = "muted" | "price" | "promo" | "discount" | "note" | "topping";

function CartDetailRow({
  children,
  className,
  icon,
  right,
  tone = "muted"
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  right?: ReactNode;
  tone?: CartDetailTone;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-2 text-[11px] font-bold leading-[18px] sm:text-xs",
        tone === "price" && "text-foreground/75",
        tone === "promo" && "text-primary",
        tone === "discount" && "text-destructive",
        tone === "note" && "text-muted-foreground",
        tone === "topping" && "text-muted-foreground",
        tone === "muted" && "text-muted-foreground",
        className
      )}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        {icon ? <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">{icon}</span> : null}
        <span className="min-w-0 break-words">{children}</span>
      </span>
      {right ? (
        <span
          className={cn(
            "shrink-0 text-right font-black tabular-nums",
            tone === "discount" ? "text-destructive" : "text-foreground/75"
          )}
        >
          {right}
        </span>
      ) : null}
    </div>
  );
}

function CartItemActionMenu({
  canCancel,
  canConfirmKitchen,
  canConfirmServed,
  canDelete,
  confirmKitchenDisabled,
  disabled,
  itemUuid,
  onCancel,
  onConfirmKitchen,
  onConfirmServed,
  onDelete,
  onEditNote,
  onItemDiscount,
  pending
}: {
  canCancel: boolean;
  canConfirmKitchen: boolean;
  canConfirmServed: boolean;
  canDelete: boolean;
  confirmKitchenDisabled: boolean;
  disabled: boolean;
  itemUuid: string | null;
  onCancel: () => void;
  onConfirmKitchen: () => void;
  onConfirmServed: () => void;
  onDelete: () => void;
  onEditNote: () => void;
  onItemDiscount: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const actionDisabled = disabled || !itemUuid;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("common.actions")}
          type="button"
          size="iconSm"
          variant="ghost"
          className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted"
          disabled={disabled || pending}
        >
          {pending ? <Spinner data-icon="inline-start" /> : <MoreVertical data-icon="inline-start" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          {canConfirmKitchen ? (
            <DropdownMenuItem disabled={confirmKitchenDisabled} onSelect={onConfirmKitchen}>
              <ChefHat />
              {t("pos.confirmToKitchen")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem disabled={actionDisabled} onSelect={onEditNote}>
            <Pencil />
            {t("pos.editNote")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={actionDisabled} onSelect={onItemDiscount}>
            <BadgePercent />
            {t("pos.itemDiscount")}
          </DropdownMenuItem>
          {canConfirmServed ? (
            <DropdownMenuItem disabled={actionDisabled} onSelect={onConfirmServed}>
              <ClipboardCheck />
              {t("pos.confirmServed")}
            </DropdownMenuItem>
          ) : null}
          {(canDelete || canCancel) ? <DropdownMenuSeparator /> : null}
          {canDelete ? (
            <DropdownMenuItem disabled={actionDisabled} variant="destructive" onSelect={onDelete}>
              <Trash2 />
              {t("pos.cancelItem")}
            </DropdownMenuItem>
          ) : null}
          {canCancel ? (
            <DropdownMenuItem disabled={actionDisabled} variant="destructive" onSelect={onCancel}>
              <Ban />
              {t("pos.cancelItem")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CartPromoBlock({
  buyQty,
  freeQty,
  receiveQty
}: {
  buyQty: number | null;
  freeQty: number | null;
  receiveQty: number | null;
}) {
  const { t } = useTranslation();
  const buyFreeText = [
    buyQty !== null ? `${t("pos.buyShort")} ${buyQty}` : null,
    freeQty !== null ? `${t("pos.freeShort")} ${freeQty}` : null
  ].filter(Boolean).join(" + ");

  if (!buyFreeText && receiveQty === null) return null;

  return (
    <CartDetailRow icon={<Gift />} tone="promo">
      {[buyFreeText, receiveQty !== null ? `${t("pos.receiveShort")} ${formatQuantityValue(receiveQty)}` : null].filter(Boolean).join(" / ")}
    </CartDetailRow>
  );
}

function CartQuantitySummary({
  saleQty,
  totalReceiveQty
}: {
  saleQty: number | null;
  totalReceiveQty: number | null;
}) {
  const { t } = useTranslation();
  const items = [
    { label: t("pos.totalReceiveQty"), value: totalReceiveQty },
    { label: t("pos.saleQty"), value: saleQty }
  ].filter((item): item is { label: string; value: number } => item.value !== null && item.value > 0);

  if (!items.length) return null;

  return (
    <CartDetailRow tone="muted">
      {items.map((item) => `${item.label}: ${formatQuantityValue(item.value)}`).join(" / ")}
    </CartDetailRow>
  );
}

function CartNote({ text }: { text: string }) {
  const { t } = useTranslation();

  return (
    <CartDetailRow icon={<StickyNote />} tone="note">
      <span className="text-foreground/70">{t("pos.note")}: </span>
      <span>{text}</span>
    </CartDetailRow>
  );
}

function CartProductMedia({ media, title }: { media: CartItemMedia; title: string }) {
  const colorStyle = media.type === "color" ? ({ backgroundColor: media.color } satisfies CSSProperties) : undefined;

  return (
    <div
      className="relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted shadow-sm sm:size-12"
      style={colorStyle}
    >
      {media.type === "image" ? (
        <Image src={media.src} alt={title} fill sizes="(max-width: 640px) 44px, 48px" className="object-cover" />
      ) : media.type === "color" ? (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10" aria-hidden="true" />
          <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <span className="grid size-7 place-items-center rounded-full bg-black/25 text-white shadow-sm backdrop-blur-[1px] sm:size-8">
              <Utensils className="size-4" />
            </span>
          </span>
        </>
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ShoppingBag />
        </div>
      )}
    </div>
  );
}

function CartToppingsList({
  toppingTotal,
  toppings
}: {
  toppingTotal: number | null;
  toppings: NonNullable<CartItem["toppings"]>;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-0.5">
      {toppingTotal !== null && !toppings.length ? (
        <CartDetailRow className="pl-5" tone="topping" right={`+${money(toppingTotal)}`}>
          + {t("pos.toppingTotal")}
        </CartDetailRow>
      ) : null}
      {toppings.map((topping, index) => {
        const name = optionalString(topping.topping_name) ?? "-";
        const qty = optionalNumber(topping.topping_qty);
        const lineTotal = positiveNumber(topping.topping_line_total, topping.topping_price);

        return (
          <CartDetailRow
            key={`${name}-${index}`}
            className="pl-5"
            tone="topping"
            right={lineTotal !== null ? `+${money(lineTotal)}` : null}
          >
            + {name}{qty !== null ? ` x${formatQuantityValue(qty)}` : ""}
          </CartDetailRow>
        );
      })}
    </div>
  );
}

function CartQuantityStepper({
  onDecrease,
  onIncrease,
  qty,
  updating
}: {
  onDecrease: () => void;
  onIncrease: () => void;
  qty: number;
  updating: boolean;
}) {
  const { t } = useTranslation();
  const locked = updating;

  return (
    <div className="flex h-11 shrink-0 items-center rounded-full border border-border bg-background shadow-sm">
      <Button
        aria-label={`${t("pos.qty")} -`}
        type="button"
        size="iconSm"
        variant="ghost"
        className="size-10 rounded-full text-muted-foreground hover:bg-muted"
        disabled={locked || qty <= 1}
        onClick={onDecrease}
      >
        <Minus />
      </Button>
      <span className="min-w-9 text-center text-sm font-black text-foreground tabular-nums">
        {updating ? <Spinner /> : qty}
      </span>
      <Button
        aria-label={`${t("pos.qty")} +`}
        type="button"
        size="iconSm"
        variant="ghost"
        className="size-10 rounded-full text-muted-foreground hover:bg-muted"
        disabled={locked}
        onClick={onIncrease}
      >
        <Plus />
      </Button>
    </div>
  );
}

function CartQuantityBadge({ qty }: { qty: number }) {
  return (
    <Badge className="h-9 rounded-full border-border bg-muted px-3 text-sm font-black text-muted-foreground">
      x{qty}
    </Badge>
  );
}
