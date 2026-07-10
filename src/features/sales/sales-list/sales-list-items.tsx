"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { BadgePercent, ShoppingBag, StickyNote, Tag, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApiEntity } from "@/services/shared/types";
import {
  firstNumber,
  itemMedia,
  itemNote,
  itemProductName,
  itemToppings,
  itemToppingTotal,
  moneyValue,
  readValue,
  textValue
} from "./sales-list-utils";

export function SalesListItems({ items }: { items: ApiEntity[] }) {
  const { t } = useTranslation();

  if (!items.length) {
    return <EmptyState title={t("salesList.noItems")} description={t("salesList.noItemsDescription")} />;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border bg-card">
      {items.map((item, index) => (
        <SalesListItemCard
          key={textValue(readValue(item, ["__report_record_id", "order_item_uuid"]), String(index))}
          item={item}
        />
      ))}
    </div>
  );
}

function SalesListItemCard({ item }: { item: ApiEntity }) {
  const { t } = useTranslation();
  const media = itemMedia(item);
  const note = itemNote(item);
  const discount = firstNumber(item, ["discount_total", "discount_amount", "item_discount_amount", "discount_item_amount"]);
  const qty = firstNumber(item, ["qty", "quantity"]);
  const total = firstNumber(item, ["total", "line_total", "net_total"]);
  const amount = firstNumber(item, ["amount", "line_amount", "product_price_total"]);
  const unitPrice = qty > 0 && total > 0 ? total / qty : firstNumber(item, ["sale_price", "price", "unit_price", "product_price"]);

  return (
    <div className="border-b border-border/80 bg-background px-3 py-2.5 last:border-b-0 hover:bg-muted/20 sm:px-4">
      <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[52px_minmax(0,1fr)]">
        <SalesListItemMedia media={media} title={itemProductName(item)} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="min-w-0 wrap-break-word text-[15px] font-black leading-5 text-foreground">
              {itemProductName(item)}
            </p>
            <p className="max-w-32 shrink-0 truncate text-right text-[15px] font-black leading-5 text-foreground tabular-nums">
              {moneyValue(total)}
            </p>
          </div>

          <div className="mt-1.5 grid gap-0.5">
            <SalesListItemDetailRow icon={<Tag />} tone="price">
              <span className="tabular-nums">
                {qty.toLocaleString("en-US")} x {moneyValue(unitPrice)}
              </span>
            </SalesListItemDetailRow>
            {amount > 0 && amount !== total ? (
              <SalesListItemDetailRow tone="muted" right={moneyValue(amount)}>
                {t("salesList.amount")}
              </SalesListItemDetailRow>
            ) : null}
            <SalesListItemToppings item={item} />
            {discount > 0 ? (
              <SalesListItemDetailRow icon={<BadgePercent />} tone="discount" right={`-${moneyValue(discount)}`}>
                {t("salesList.discount")}
              </SalesListItemDetailRow>
            ) : null}
            {note ? (
              <SalesListItemDetailRow icon={<StickyNote />} tone="note">
                <span className="text-foreground/70">{t("salesList.note")}: </span>
                <span>{note}</span>
              </SalesListItemDetailRow>
            ) : null}
          </div>

          <div className="mt-2 flex min-w-0 justify-end">
            <Badge className="h-9 rounded-full border-border bg-muted px-3 text-sm font-black text-muted-foreground">
              x{qty.toLocaleString("en-US")}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesListItemMedia({
  media,
  title
}: {
  media: ReturnType<typeof itemMedia>;
  title: string;
}) {
  const colorStyle = media.type === "color" ? ({ backgroundColor: media.color } satisfies CSSProperties) : undefined;

  return (
    <div
      className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted shadow-sm"
      style={colorStyle}
    >
      {media.type === "image" ? (
        <Image src={media.src} alt={title} fill sizes="(max-width: 640px) 48px, 52px" className="object-cover" />
      ) : media.type === "color" ? (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10" aria-hidden="true" />
          <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <span className="grid size-8 place-items-center rounded-full bg-black/25 text-white shadow-sm backdrop-blur-[1px]">
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

type SalesListItemDetailTone = "discount" | "muted" | "note" | "price" | "topping";

function SalesListItemDetailRow({
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
  tone?: SalesListItemDetailTone;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-2 text-[11px] font-bold leading-4.5 sm:text-xs",
        tone === "price" && "text-foreground/75",
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

function SalesListItemToppings({ item }: { item: ApiEntity }) {
  const { t } = useTranslation();
  const toppings = itemToppings(item);
  const toppingTotal = itemToppingTotal(item);

  if (!toppings.length && toppingTotal <= 0) return null;

  return (
    <div className="grid gap-0.5">
      {toppings.length ? (
        toppings.map((topping, index) => (
          <SalesListItemDetailRow
            key={`${topping.name}-${index}`}
            className="pl-5"
            tone="topping"
            right={topping.total > 0 ? `+${moneyValue(topping.total)}` : null}
          >
            + {topping.name}{topping.qty > 0 ? ` x${topping.qty.toLocaleString("en-US")}` : ""}
          </SalesListItemDetailRow>
        ))
      ) : (
        <SalesListItemDetailRow className="pl-5" tone="topping" right={`+${moneyValue(toppingTotal)}`}>
          + {t("pos.toppingTotal")}
        </SalesListItemDetailRow>
      )}
    </div>
  );
}
