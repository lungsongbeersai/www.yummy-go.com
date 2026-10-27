"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRightLeft, Check, ChefHat, Minus, Plus, Receipt, Search, Split, Users, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SimulatorItem, SimulatorOrder, SimulatorPermissions, SimulatorProduct, SimulatorSession, SimulatorTable } from "@/services/simulator";
import { useSimulatorStore } from "@/stores/simulator-store";
import { BillDialog, type BillDialogType } from "./bill-dialog";
import { SimConfirm } from "./confirmation";
import { SimField, SimSelect } from "./fields";
import { formatSimMoney, itemStatusLabel, orderName } from "./helpers";
import { ProductDialog } from "./product-dialog";
import { VisitDialog } from "./visit-dialog";
import { CancelItemDialog } from "./cancel-item-dialog";

export function OrderPanel({ session, order, table, permissions, disabled }: {
  session: SimulatorSession; order?: SimulatorOrder; table?: SimulatorTable; permissions: SimulatorPermissions; disabled: boolean;
}) {
  const { t } = useTranslation("simulator");
  const command = useSimulatorStore((state) => state.command);
  const [customer, setCustomer] = useState(order?.customer_name ?? "");
  const [guests, setGuests] = useState(order?.guests ?? 1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [product, setProduct] = useState<SimulatorProduct | null>(null);
  const [editItem, setEditItem] = useState<SimulatorItem | undefined>();
  const [dialog, setDialog] = useState<{ type: BillDialogType; itemId?: string } | null>(null);
  const [tab, setTab] = useState("bill");
  const [visitOpen, setVisitOpen] = useState(false);
  const categories = useMemo(() => [...new Map(session.catalog.map((entry) => [entry.category_uuid, entry.category_name])).entries()], [session.catalog]);
  const products = session.catalog.filter((entry) => (category === "all" || entry.category_uuid === category) && entry.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const locked = disabled || !permissions.operate;
  const hasPayments = Boolean(order?.payments.length);

  if (!order) return <div className="p-5">
    <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><UtensilsCrossed className="size-5" /></div><div><h2 className="text-lg font-semibold">{table?.name ?? t(session.config.use_tables ? "selectTable" : "counter")}</h2><p className="text-xs text-muted-foreground">{table?.zone_name ?? t(session.config.use_tables ? "branchHelp" : "noTables")}</p></div></div>
    {(table || session.config.use_tables === false) ? <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void command("open_table", { table_uuid: table?.table_uuid ?? null, guests, customer_name: customer }); }}>
      <SimField label={t("customer")}><Input aria-label={t("customer")} className="h-11" maxLength={100} value={customer} onChange={(event) => setCustomer(event.target.value)} /></SimField>
      <SimField label={t("guests")}><Input aria-label={t("guests")} className="h-11" type="number" min={1} max={100} value={guests} onChange={(event) => setGuests(Number(event.target.value))} /></SimField>
      <Button className="h-11 w-full" disabled={locked || !Number.isSafeInteger(guests) || guests < 1}><Plus />{t(table ? "openTable" : "openCounter")}</Button>
    </form> : <Empty><EmptyHeader><EmptyTitle>{t("selectTable")}</EmptyTitle><EmptyDescription>{t("selectHelp")}</EmptyDescription></EmptyHeader></Empty>}
  </div>;

  return <div className="flex min-h-0 flex-col">
    <div className="border-b p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{t("currentBill")}</p><h2 className="text-xl font-semibold">{orderName(order, session)}</h2></div><Badge variant="secondary"><Users className="mr-1 size-3" />{order.guests}</Badge></div>
      <div className="mt-3 flex gap-2"><Input aria-label={t("customer")} className="h-10" value={customer} maxLength={100} onChange={(event) => setCustomer(event.target.value)} /><Button aria-label={t("assign")} title={t("assign")} className="size-10" variant="outline" disabled={locked || customer === order.customer_name} onClick={() => void command("assign_customer", { order_uuid: order.order_uuid, customer_name: customer })}><Check /></Button>
        <Input aria-label={t("guests")} className="h-10 w-16" type="number" min={1} max={100} value={guests} onChange={(event) => setGuests(Number(event.target.value))} /><Button aria-label={t("updateGuests")} title={t("updateGuests")} className="size-10" variant="outline" disabled={locked || hasPayments || !Number.isSafeInteger(guests) || guests < 1 || guests === order.guests} onClick={() => void command("guests", { order_uuid: order.order_uuid, guests })}><Users /></Button></div>
      {(session.profiles ?? []).length > 0 && <div className="mt-3"><SimSelect label={t("assign")} value={order.customer_uuid ?? ""} disabled={locked} onChange={async (customer_uuid) => { if (await command("assign_customer", { order_uuid: order.order_uuid, customer_uuid })) setCustomer(session.profiles?.find((profile) => profile.customer_uuid === customer_uuid)?.name ?? ""); }} options={(session.profiles ?? []).map((profile) => ({ value: profile.customer_uuid, label: profile.name }))} /></div>}
    </div>
    <Tabs value={tab} onValueChange={setTab} className="min-h-0 gap-0"><TabsList className="mx-4 my-3 grid h-10 w-auto grid-cols-2"><TabsTrigger value="bill"><Receipt />{t("bill")}</TabsTrigger><TabsTrigger value="menu"><Plus />{t("menu")}</TabsTrigger></TabsList>
      <TabsContent value="bill" className="m-0 flex flex-col gap-4 px-4 pb-4">
        {!order.items.length && <Empty className="py-6"><EmptyHeader><EmptyTitle>{t("emptyCart")}</EmptyTitle><EmptyDescription>{t("emptyCartHelp")}</EmptyDescription></EmptyHeader><Button variant="outline" className="h-10" onClick={() => setTab("menu")}><Plus />{t("menu")}</Button></Empty>}
        <div className="flex flex-col gap-3">{order.items.map((item) => {
          const editable = !hasPayments && (session.config.use_tables ? item.status === 1 : [1, 2].includes(item.status));
          const catalog = session.catalog.find((entry) => entry.detail_uuid === item.detail_uuid);
          return <article key={item.item_uuid} className={item.status === 9 ? "rounded-xl border border-dashed p-3 opacity-60" : "rounded-xl border bg-card p-3"}>
            <div className="flex justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-medium">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{formatSimMoney(item.unit_price)} · {t(itemStatusLabel(item.status))}</p></div><span className="text-sm font-semibold tabular-nums">{formatSimMoney(item.quantity * item.unit_price)}</span></div>
            {Boolean(item.promo_free_qty) && <p className="mt-2 text-xs text-success">+{item.promo_free_qty} {t("promotion.free")}</p>}
            {item.toppings.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{item.toppings.map((entry) => `${entry.quantity} × ${entry.name ?? entry.topping_uuid}`).join(", ")}</p>}
            {item.options.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{item.options.map((id) => catalog?.options.find((entry) => entry.option_uuid === id)?.name ?? id).join(", ")}</p>}
            {item.note && <p className="mt-2 break-words text-xs text-muted-foreground">{item.note}</p>}
            {item.status !== 9 && <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center rounded-lg border"><Button aria-label={`${t("quantity")} − ${item.name}`} size="icon" className="size-10" variant="ghost" disabled={locked || !editable || item.quantity <= 1} onClick={() => void command("edit_item", { order_uuid: order.order_uuid, item_uuid: item.item_uuid, quantity: item.quantity - 1 })}><Minus /></Button><span className="min-w-7 text-center text-sm tabular-nums">{item.quantity}</span><Button aria-label={`${t("quantity")} + ${item.name}`} size="icon" className="size-10" variant="ghost" disabled={locked || !editable} onClick={() => void command("edit_item", { order_uuid: order.order_uuid, item_uuid: item.item_uuid, quantity: item.quantity + 1 })}><Plus /></Button></div>
              <div className="flex items-center gap-1">{editable && catalog && <Button className="h-10" variant="ghost" disabled={locked} onClick={() => { setEditItem(item); setProduct(catalog); }}>{t("edit")}</Button>}
                {permissions.discount && !hasPayments && <Button className="h-10" variant="ghost" disabled={locked} onClick={() => setDialog({ type: "discount", itemId: item.item_uuid })}>%</Button>}
                {permissions.cancel && !hasPayments && [0, 1, 2, 3].includes(item.status) && <CancelItemDialog item={item} orderId={order.order_uuid} disabled={locked} />}
              </div></div>}
          </article>;
        })}</div>
        <div className="flex flex-col gap-2 border-t pt-3">{(["subtotal", "item_discount", "bill_discount", "service", "vat"] as const).map((key) => <div key={key} className="flex justify-between text-xs text-muted-foreground"><span>{t(({ item_discount: "itemDiscount", bill_discount: "billDiscount" } as Record<string, string>)[key] ?? key)}</span><span className="tabular-nums">{formatSimMoney(order.totals[key])}</span></div>)}<div className="flex items-baseline justify-between border-t pt-3"><span className="font-medium">{t("total")}</span><span className="text-xl font-semibold tabular-nums">{formatSimMoney(order.totals.total)}</span></div>{hasPayments && <div className="flex justify-between text-sm"><span>{t("balance")}</span><span>{formatSimMoney(order.totals.balance)}</span></div>}</div>
        <div className="grid gap-2"><Button className="h-11" disabled={locked || !permissions.confirm || !order.items.some((item) => item.status === 1)} onClick={() => void command("confirm", { order_uuid: order.order_uuid })}><ChefHat />{t("confirm")}</Button>
          <Button variant="secondary" className="h-11" disabled={locked || !permissions.pay || !order.items.some((item) => [2, 4].includes(item.status)) || order.items.some((item) => item.status === 1)} onClick={() => setDialog({ type: "pay" })}><Receipt />{t("payment")}</Button></div>
        <div className="border-t pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">{t("orderActions")}</p><div className="grid grid-cols-2 gap-2">
          {permissions.discount && <Button className="h-10" variant="outline" disabled={locked || hasPayments} onClick={() => setDialog({ type: "discount" })}>% {t("discount")}</Button>}
          <Button className="h-10" variant="outline" disabled={locked} onClick={() => void command("request_bill", { order_uuid: order.order_uuid })}><Receipt />{t("requestBill")}</Button>
          {order.table_uuid && <Button className="h-10" variant="outline" disabled={locked} onClick={async () => { if (await command("visit_create", { table_uuid: order.table_uuid })) setVisitOpen(true); }}>{t("visits.tableQR")}</Button>}
          {permissions.transfer && session.config.use_tables && <><Button className="h-10" variant="outline" disabled={locked || hasPayments} onClick={() => setDialog({ type: "transfer" })}><ArrowRightLeft />{t("move")}</Button><Button className="h-10" variant="outline" disabled={locked || hasPayments} onClick={() => setDialog({ type: "merge" })}>{t("merge")}</Button></>}
          {permissions.split && <Button className="h-10" variant="outline" disabled={locked || hasPayments || !order.items.some((item) => [1, 2, 4].includes(item.status))} onClick={() => setDialog({ type: "split" })}><Split />{t("split")}</Button>}
          <SimConfirm title={t("cleanupTitle")} description={t("cleanupHelp")} onConfirm={() => void command("cleanup", { order_uuid: order.order_uuid })}><Button className="h-10" variant="destructive" disabled={locked || hasPayments || (order.items.some((item) => item.status !== 9) && !order.items.some((item) => item.status === 1))}>{t("cleanup")}</Button></SimConfirm>
        </div></div>
      </TabsContent>
      <TabsContent value="menu" className="m-0 flex flex-col gap-3 px-4 pb-4"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label={t("search")} className="h-11 pl-10" placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} /></div><SimSelect label={t("allCategories")} value={category} onChange={setCategory} options={[{ value: "all", label: t("allCategories") }, ...categories.map(([value, label]) => ({ value, label }))]} />
        <div className="grid gap-2">{products.map((entry) => <Button key={entry.detail_uuid} className="h-auto min-h-18 justify-start whitespace-normal rounded-xl p-3 text-left" variant="outline" disabled={locked || hasPayments || !entry.supported} title={entry.unsupported_reason} onClick={() => { setEditItem(undefined); setProduct(entry); }}><div className="min-w-0 flex-1"><p className="text-sm font-medium">{entry.name}</p><p className="mt-1 text-xs text-muted-foreground">{entry.category_name}</p>{!entry.supported && <p className="mt-1 text-xs text-destructive">{entry.unsupported_reason ?? t("unsupported")}</p>}{entry.track_stock && <p className="mt-1 text-xs text-muted-foreground">{t("stock")}: {session.inventory?.[entry.detail_uuid] ?? entry.stock}</p>}</div><span className="ml-2 text-sm font-semibold tabular-nums">{formatSimMoney(entry.price)}</span><Plus className="ml-2 size-4" /></Button>)}</div>
        {!products.length && <Empty><EmptyHeader><EmptyTitle>{t("noProducts")}</EmptyTitle></EmptyHeader></Empty>}
      </TabsContent>
    </Tabs>
    {product && <ProductDialog product={product} item={editItem} orderId={order.order_uuid} disabled={locked} onClose={() => { setProduct(null); setEditItem(undefined); }} />}
    {dialog && <BillDialog type={dialog.type} itemId={dialog.itemId} order={order} session={session} disabled={locked} onClose={() => setDialog(null)} />}
    {visitOpen && order.table_uuid && <VisitDialog session={session} tableId={order.table_uuid} disabled={locked} onClose={() => setVisitOpen(false)} />}
  </div>;
}
