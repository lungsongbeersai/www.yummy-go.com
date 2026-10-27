"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SimulatorOrder, SimulatorSession } from "@/services/simulator";
import { useSimulatorStore } from "@/stores/simulator-store";
import { SimField, SimSelect } from "./fields";
import { formatSimMoney, orderName } from "./helpers";
import { SimConfirm } from "./confirmation";

export type BillDialogType = "discount" | "transfer" | "merge" | "split" | "pay";
export function BillDialog({ type, order, session, itemId, disabled, onClose }: {
  type: BillDialogType; order: SimulatorOrder; session: SimulatorSession; itemId?: string; disabled: boolean; onClose: () => void;
}) {
  const { t } = useTranslation("simulator");
  const command = useSimulatorStore((state) => state.command);
  const [target, setTarget] = useState("");
  const [discountType, setDiscountType] = useState("1");
  const [discountValue, setDiscountValue] = useState("0");
  const [items, setItems] = useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [currency, setCurrency] = useState("LAK");
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(String(order.totals.balance));
  const active = order.items.filter((item) => item.status !== 9);
  const currencies = session.config.currencies ?? [];
  const label = type === "transfer" ? "move" : type === "pay" ? "payment" : type;
  const submit = async () => {
    const payload: Record<string, unknown> = { order_uuid: order.order_uuid };
    if (type === "discount") Object.assign(payload, { discount_type: Number(discountType), discount_value: Number(discountValue), ...(itemId ? { item_uuid: itemId } : {}) });
    if (type === "transfer") payload.target_table_uuid = target;
    if (type === "merge") payload.target_order_uuid = target;
    if (type === "split") { payload.item_uuids = items; payload.item_quantities = Object.fromEntries(items.map((id) => [id, itemQuantities[id] ?? active.find((entry) => entry.item_uuid === id)?.quantity])); }
    if (type === "pay") Object.assign(payload, { currency, method, amount: Number(amount) });
    if (await command(type, payload)) onClose();
  };
  const valid = type === "pay" ? Number.isFinite(Number(amount)) && (order.totals.balance === 0 ? Number(amount) === 0 : Number(amount) > 0) && currencies.some((entry) => entry.code === currency) :
    type === "discount" ? Number.isFinite(Number(discountValue)) && Number(discountValue) >= 0 && (discountType !== "1" || Number(discountValue) <= 100) :
      type === "split" ? items.length > 0 && items.every((id) => { const quantity = itemQuantities[id] ?? active.find((entry) => entry.item_uuid === id)?.quantity ?? 0; return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= (active.find((entry) => entry.item_uuid === id)?.quantity ?? 0); }) : Boolean(target);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>{t(label)} · {orderName(order, session)}</DialogTitle><DialogDescription>{t(type === "pay" ? "paymentHelp" : type === "split" ? "chooseItems" : "currentBill")}</DialogDescription></DialogHeader>
    {type === "discount" && <div className="grid grid-cols-2 gap-3"><SimField label={t("discount")}><SimSelect label={t("discount")} value={discountType} onChange={setDiscountType} options={[{ value: "0", label: t("none") }, { value: "1", label: t("percent") }, { value: "2", label: t("fixed") }]} /></SimField><SimField label={t("amount")}><Input className="h-10" aria-label={t("amount")} type="number" min={0} max={discountType === "1" ? 100 : undefined} value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} /></SimField></div>}
    {(type === "transfer" || type === "merge") && <SimField label={t("target")}><SimSelect label={t("target")} value={target} onChange={setTarget} options={type === "transfer"
      ? session.tables.filter((table) => table.status === 1 && !table.order_uuid).map((table) => ({ value: table.table_uuid, label: `${table.name} · ${table.zone_name}` }))
      : session.orders.filter((entry) => entry.status === "open" && entry.order_uuid !== order.order_uuid && entry.table_uuid && session.tables.find((table) => table.table_uuid === entry.table_uuid)?.status === 2).map((entry) => ({ value: entry.order_uuid, label: orderName(entry, session) }))} /></SimField>}
    {type === "split" && <div className="flex flex-col gap-2">{active.map((item) => <div key={item.item_uuid} className="flex min-h-11 items-center gap-3 rounded-lg border p-3"><Checkbox aria-label={`${t("split")} ${item.name}`} disabled={![1, 2, 4].includes(item.status)} checked={items.includes(item.item_uuid)} onCheckedChange={(checked) => setItems((old) => checked ? [...old, item.item_uuid] : old.filter((id) => id !== item.item_uuid))} /><span className="flex-1">{item.quantity} × {item.name}</span><Input className="h-10 w-20" type="number" aria-label={`${t("quantity")} ${item.name}`} min={1} max={item.quantity} disabled={!items.includes(item.item_uuid)} value={itemQuantities[item.item_uuid] ?? item.quantity} onChange={(event) => setItemQuantities((old) => ({ ...old, [item.item_uuid]: Number(event.target.value) }))} /><span className="text-xs tabular-nums">{formatSimMoney(item.unit_price * item.quantity)}</span></div>)}</div>}
    {type === "pay" && <div className="flex flex-col gap-4"><div className="rounded-xl bg-primary/10 p-5"><p className="text-xs text-muted-foreground">{t("balance")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{formatSimMoney(order.totals.balance)}</p></div>
      <div className="grid grid-cols-2 gap-3"><SimField label={t("method")}><SimSelect label={t("method")} value={method} onChange={setMethod} options={(session.config.payment_methods ?? []).map((value) => ({ value, label: t(value) }))} /></SimField>
        <SimField label={t("currency")}><SimSelect label={t("currency")} value={currency} onChange={(code) => { setCurrency(code); const rate = currencies.find((entry) => entry.code === code)?.rate; if (rate) setAmount(String(Math.ceil(order.totals.balance / rate * 100) / 100)); }} options={currencies.map((entry) => ({ value: entry.code, label: `${entry.code} · 1 = ${entry.rate} LAK` }))} /></SimField></div>
      <SimField label={t("amount")}><Input className="h-12 text-lg" aria-label={t("amount")} type="number" min={order.totals.balance === 0 ? 0 : 0.01} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></SimField>
    </div>}
    <DialogFooter><Button className="h-11" variant="outline" onClick={onClose}>{t("back")}</Button>
      {type === "merge" ? <SimConfirm title={t("merge")} description={`${orderName(order, session)} → ${session.orders.find((entry) => entry.order_uuid === target) ? orderName(session.orders.find((entry) => entry.order_uuid === target)!, session) : ""}`} onConfirm={() => void submit()} disabled={disabled || !valid}><Button className="h-11" disabled={disabled || !valid}>{t("merge")}</Button></SimConfirm> :
        <Button className="h-11" disabled={disabled || !valid} onClick={() => void submit()}>{t(type === "pay" ? "pay" : type === "discount" ? "apply" : label)}</Button>}
    </DialogFooter>
  </DialogContent></Dialog>;
}
