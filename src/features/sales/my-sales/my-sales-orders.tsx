import { ReceiptText, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";
import { cartSelectionNames } from "@/lib/pos/set-child-options";
import { cn } from "@/lib/utils";
import type { MySalesItem, MySalesOrder } from "@/services/pos";
import { MySalesKitchenBadge, MySalesPaymentBadge } from "./my-sales-status";

function saleTime(value: string | null | undefined, language: string) {
  if (!value) return "-";
  const timestamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}+07:00`
    : value;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language === "en" ? "en-GB" : "lo-LA", {
    timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

export function MySalesOrders({ orders }: { orders: MySalesOrder[] }) {
  const { t, i18n } = useTranslation();
  return (
    <Accordion type="multiple" className="border-border bg-card">
      {orders.map((order) => (
        <AccordionItem key={order.order_uuid} value={order.order_uuid}>
          <AccordionTrigger className="items-start px-3 py-4 text-left hover:no-underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4">
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <ReceiptText className="size-4 shrink-0 text-primary-text" />
                  <span className="break-all">{order.order_invoice || order.order_uuid}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{money(order.total)}</span>
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Table2 className="size-3.5" />{order.table_name || t("mySales.noTable")}{order.zone_name ? ` · ${order.zone_name}` : ""}</span>
                <span>{saleTime(order.order_date_time, i18n.language)}</span>
                <span>{t("mySales.itemCount", { count: order.item_count })}</span>
              </span>
              <span className="flex flex-wrap gap-2"><MySalesKitchenBadge status={order.kitchen_status} /><MySalesPaymentBadge status={order.payment_status} /></span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-4 sm:px-4">
            <div className="rounded-lg border border-border bg-background">
              <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">{t("mySales.myItems")}</div>
              <ul className="divide-y divide-border">
                {order.items.map((item) => <MySalesItemRow key={item.order_it_uuid} item={item} />)}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-3">
                <span className="text-xs text-muted-foreground">{t("mySales.ownTotal")}</span>
                <span className="font-semibold tabular-nums">{money(order.total)}</span>
              </div>
            </div>
            {order.payment_status === "paid" && order.date_time_payment ? <p className="mt-2 text-xs text-muted-foreground">{t("mySales.checkedAt")} {saleTime(order.date_time_payment, i18n.language)}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">{t("mySales.totalDescription")}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function MySalesItemRow({ item }: { item: MySalesItem }) {
  const { t, i18n } = useTranslation();
  const cancelled = Number(item.status) === 9;
  const setMember = Number(item.status_sort_fk) === 2;
  const selections = cartSelectionNames(item, i18n.language);
  const toppings = item.toppings?.map((topping) => `${i18n.language === "en" ? topping.topping_name_eng || topping.topping_name_la : topping.topping_name_la || topping.topping_name_eng} × ${topping.quantity}`).filter(Boolean) ?? [];
  return (
    <li className={cn("flex flex-col gap-2 px-3 py-3", cancelled && "text-muted-foreground")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("break-words text-sm font-medium", cancelled && "line-through")}>{item.product_name}{item.size_name ? ` · ${item.size_name}` : ""}</p>
          <p className="mt-1 text-xs text-muted-foreground">{setMember ? t("mySales.setMember", { count: item.quantity }) : `${item.quantity} × ${money(item.price)}`}</p>
        </div>
        {!setMember ? <span className="shrink-0 text-sm tabular-nums">{money(item.total)}</span> : null}
      </div>
      {selections.length || toppings.length ? <p className="break-words text-xs text-muted-foreground">{[...selections, ...toppings].join(" · ")}</p> : null}
      {item.note ? <p className="break-words text-xs text-muted-foreground">{t("mySales.note")}: {item.note}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {cancelled ? <Badge variant="destructive">{t("mySales.payment.cancelled")}</Badge> : <MySalesKitchenBadge status={item.kitchen_sent ? "sent" : "pending"} />}
        {!cancelled && item.kitchen_confirmed_at ? <span className="text-xs text-muted-foreground">{saleTime(item.kitchen_confirmed_at, i18n.language)}</span> : null}
      </div>
    </li>
  );
}
