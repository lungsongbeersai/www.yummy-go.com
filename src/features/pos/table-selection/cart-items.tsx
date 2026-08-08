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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/format";
import { promotionQuantity } from "@/lib/pos/cart-quantity";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/services/pos";
import type { CartItemAction, CartTab } from "./types";
import { cartItemActionUuid, cartItemBaseUnitPrice, cartItemDisplayName, cartItemMedia, cartItemName, cartItemQty, cartItemStatus, cartItemTotal, cartItemUuid, cartToppingDisplay, differentNumber, formatPlainValue, formatPositiveMoneyValue, formatQuantityValue, formatRate, isCanceledCartItem, isServedCartItem, optionalBoolean, optionalNumber, optionalString, positiveNumber, type CartItemMedia } from "./utils";

export function CartTabTrigger({
  active,
  count,
  disabled = false,
  label,
  shortLabel,
  value
}: {
  active: boolean;
  count: number;
  disabled?: boolean;
  label: string;
  shortLabel?: string;
  value: CartTab;
}) {
  return (
    <TabsTrigger
      value={value}
      disabled={disabled}
      aria-label={`${label}: ${count}`}
      title={label}
      className="h-full min-w-0 gap-1.5 rounded-lg px-2.5 text-[13px] font-black text-white/80 transition-colors data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="min-w-0 truncate sm:hidden">{shortLabel ?? label}</span>
      <span className="hidden min-w-0 truncate sm:inline">{label}</span>
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
  compact = false,
  editable = false,
  items,
  onChangeQty,
  onConfirmKitchen,
  onConfirmServed,
  onEditNote,
  onItemDiscount,
  onOpenItemAction,
  onOpenQuantityDialog,
  onToggleSplitItem,
  splitSelectionDisabled = false,
  splitSelectedItemUuids,
  updatingItemUuid
}: {
  actingItemUuid: string | null;
  actionDisabled: boolean;
  canSplitItem?: (item: CartItem) => boolean;
  canConfirmKitchenItem: (item: CartItem) => boolean;
  compact?: boolean;
  editable?: boolean;
  items: CartItem[];
  onChangeQty: (item: CartItem, changeQty: number) => void;
  onConfirmKitchen: (item: CartItem) => void;
  onConfirmServed: (item: CartItem) => void;
  onEditNote: (item: CartItem) => void;
  onItemDiscount: (item: CartItem) => void;
  onOpenItemAction: (action: CartItemAction, item: CartItem) => void;
  onOpenQuantityDialog: (item: CartItem) => void;
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
            compact={compact}
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
            onOpenQuantityDialog={onOpenQuantityDialog}
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
    <Empty className="min-h-60 flex-1 border-0 bg-background p-8">
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
  compact,
  editable,
  item,
  onChangeQty,
  onConfirmKitchen,
  onConfirmServed,
  onEditNote,
  onItemDiscount,
  onOpenItemAction,
  onOpenQuantityDialog,
  onToggleSplitItem,
  splitEligible,
  splitSelectionDisabled,
  splitSelected,
  updating
}: {
  acting: boolean;
  actionDisabled: boolean;
  canConfirmKitchen: boolean;
  compact: boolean;
  editable: boolean;
  item: CartItem;
  onChangeQty: (item: CartItem, changeQty: number) => void;
  onConfirmKitchen: (item: CartItem) => void;
  onConfirmServed: (item: CartItem) => void;
  onEditNote: (item: CartItem) => void;
  onItemDiscount: (item: CartItem) => void;
  onOpenItemAction: (action: CartItemAction, item: CartItem) => void;
  onOpenQuantityDialog: (item: CartItem) => void;
  onToggleSplitItem?: (item: CartItem) => void;
  splitEligible: boolean;
  splitSelectionDisabled?: boolean;
  splitSelected?: boolean;
  updating: boolean;
}) {
  const { t } = useTranslation();
  const detail = item.detail;
  const qty = cartItemQty(item);
  const qtyStep = promotionQuantity(detail, qty).qtyStep;
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
  const displayUnitPrice = cartItemBaseUnitPrice(item);
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
  const isCanceled = isCanceledCartItem(item);
  const canDelete = statusValue === 0 || statusValue === 1;
  const canCancel = !editable && statusValue !== 0 && statusValue !== 1 && !isCanceled;
  const canConfirmServed = !editable && statusValue !== 0 && statusValue !== 1 && !isCanceled && !isServedCartItem(item);
  const splitSelectable = Boolean(splitEligible && itemUuid && onToggleSplitItem);
  const splitEnabled = splitSelectable && !splitSelectionDisabled;
  const isWaitingConfirm = statusValue === 0;

  function toggleSplitSelection() {
    if (!splitEnabled) return;
    onToggleSplitItem?.(item);
  }

  return (
    <div
      className={cn(
        "border-b border-border/80 bg-background transition-colors last:border-b-0 hover:bg-muted/20",
        compact ? "px-2.5 py-2" : "px-2.5 py-2.5 sm:px-3",
        isWaitingConfirm &&
          "border-l-4 border-l-amber-400 bg-amber-50/70 hover:bg-amber-50 dark:border-l-amber-500 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
        isCanceled && "bg-destructive/5 hover:bg-destructive/10",
        splitSelectable && !splitEnabled && "cursor-not-allowed opacity-60",
        splitSelected && "border-l-4 border-l-primary bg-primary/5 hover:bg-primary/10"
      )}
    >
      <div
        className={cn(
          "grid min-w-0 gap-2",
          compact
            ? splitSelectable
              ? "grid-cols-[36px_40px_minmax(0,1fr)]"
              : "grid-cols-[40px_minmax(0,1fr)]"
            : splitSelectable
              ? "grid-cols-[40px_40px_minmax(0,1fr)] sm:grid-cols-[40px_44px_minmax(0,1fr)]"
              : "grid-cols-[40px_minmax(0,1fr)] sm:grid-cols-[44px_minmax(0,1fr)]"
        )}
      >
        {splitSelectable ? (
          <Label
            className={cn(
              "flex size-10 shrink-0 items-start justify-center pt-0.5",
              compact && "size-9",
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
          </Label>
        ) : null}
        <CartProductMedia compact={compact} media={media} title={title} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-1">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <p
                className={cn(
                  "min-w-0 wrap-break-word font-black text-foreground",
                  compact
                    ? "text-[14px] leading-4.5"
                    : "text-[14px] leading-5 sm:text-[15px]",
                )}
              >
                {title}
              </p>
              {statusText || isWaitingConfirm ? (
                <Badge
                  className={cn(
                    "rounded-md border-transparent font-black shadow-none",
                    compact
                      ? "h-5 px-1.5 text-[10px]"
                      : "h-6 px-2 text-[11px]",
                    isCanceled
                      ? "bg-destructive text-destructive-foreground"
                      : isWaitingConfirm
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {statusText ?? t("pos.cartStatusWaitingConfirm")}
                </Badge>
              ) : statusValue !== null ? (
                <Badge
                  className={cn(
                    "rounded-md font-black shadow-none",
                    compact
                      ? "h-5 px-1.5 text-[10px]"
                      : "h-6 px-2 text-[11px]",
                    isCanceled && "bg-destructive text-destructive-foreground"
                  )}
                >
                  {formatPlainValue(statusValue)}
                </Badge>
              ) : null}
            </div>
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

          {hasDetailContent ? (
            <div className={cn("grid gap-0.5", compact ? "mt-1" : "mt-1.5")}>
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

          <div
            className={cn(
              "flex min-w-0 items-center justify-between gap-2",
              compact ? "mt-1.5" : "mt-2",
            )}
          >
            <p
              className={cn(
                "min-w-0 truncate font-black leading-5 text-foreground tabular-nums",
                compact ? "text-[14px]" : "text-[14px] sm:text-[15px]",
                isCanceled && "text-destructive",
              )}
            >
              {money(total)}
            </p>
            {editable ? (
              <CartQuantityStepper
                compact={compact}
                qty={qty}
                updating={updating}
                onDecrease={() => onChangeQty(item, -qtyStep)}
                onIncrease={() => onChangeQty(item, qtyStep)}
                onOpenQuantityDialog={() => onOpenQuantityDialog(item)}
                qtyStep={qtyStep}
              />
            ) : (
              <CartQuantityBadge compact={compact} qty={qty} />
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
        "flex min-w-0 items-start justify-between gap-2 text-[11px] font-bold leading-4.5 sm:text-xs",
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
        <span className="min-w-0 wrap-break-word">{children}</span>
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

function CartProductMedia({
  compact,
  media,
  title,
}: {
  compact: boolean;
  media: CartItemMedia;
  title: string;
}) {
  const colorStyle = media.type === "color" ? ({ backgroundColor: media.color } satisfies CSSProperties) : undefined;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border border-border bg-muted shadow-sm",
        compact ? "size-10" : "size-10 sm:size-11",
      )}
      style={colorStyle}
    >
      {media.type === "image" ? (
        <Image
          src={media.src}
          alt={title}
          fill
          sizes={compact ? "40px" : "(max-width: 640px) 40px, 44px"}
          className="object-contain"
        />
      ) : media.type === "color" ? (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10" aria-hidden="true" />
          <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <span className="grid size-7 place-items-center rounded-full bg-black/25 text-white shadow-sm backdrop-blur-[1px]">
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
        const { qty, total } = cartToppingDisplay(topping);

        return (
          <CartDetailRow
            key={`${name}-${index}`}
            className="pl-5"
            tone="topping"
            right={total !== null ? `+${money(total)}` : null}
          >
            + {name}{qty !== null ? ` x${formatQuantityValue(qty)}` : ""}
          </CartDetailRow>
        );
      })}
    </div>
  );
}

function CartQuantityStepper({
  compact,
  onDecrease,
  onIncrease,
  onOpenQuantityDialog,
  qty,
  qtyStep,
  updating
}: {
  compact: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onOpenQuantityDialog: () => void;
  qty: number;
  qtyStep: number;
  updating: boolean;
}) {
  const { t } = useTranslation();
  const locked = updating;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center rounded-full border border-border bg-background shadow-sm",
        compact ? "h-9" : "h-11",
      )}
    >
      <Button
        aria-label={`${t("pos.qty")} -`}
        type="button"
        size="iconSm"
        variant="ghost"
        className={cn(
          "rounded-full text-muted-foreground hover:bg-muted",
          compact ? "size-8" : "size-10",
        )}
        disabled={locked || qty <= qtyStep}
        onClick={onDecrease}
      >
        <Minus className={compact ? "size-3.5" : undefined} />
      </Button>
      <Button
        aria-label={t("pos.editQuantity")}
        type="button"
        size="iconSm"
        variant="ghost"
        className={cn(
          "min-w-7 rounded-full px-1 text-center font-black text-foreground tabular-nums hover:bg-muted",
          compact ? "h-8 text-[13px]" : "h-10 text-sm",
        )}
        disabled={locked}
        onClick={onOpenQuantityDialog}
      >
        {updating ? <Spinner /> : qty}
      </Button>
      <Button
        aria-label={`${t("pos.qty")} +`}
        type="button"
        size="iconSm"
        variant="ghost"
        className={cn(
          "rounded-full text-muted-foreground hover:bg-muted",
          compact ? "size-8" : "size-10",
        )}
        disabled={locked}
        onClick={onIncrease}
      >
        <Plus className={compact ? "size-3.5" : undefined} />
      </Button>
    </div>
  );
}

function CartQuantityBadge({
  compact,
  qty,
}: {
  compact: boolean;
  qty: number;
}) {
  return (
    <Badge
      className={cn(
        "rounded-full border-border bg-muted font-black text-muted-foreground",
        compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
      )}
    >
      x{qty}
    </Badge>
  );
}
