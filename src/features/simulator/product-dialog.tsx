"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SimulatorItem, SimulatorProduct } from "@/services/simulator";
import { useSimulatorStore } from "@/stores/simulator-store";
import { SimField } from "./fields";
import { formatSimMoney } from "./helpers";

export function ProductDialog({ product, item, orderId, onClose, disabled, visitorToken }: {
  product: SimulatorProduct; item?: SimulatorItem; orderId: string; onClose: () => void; disabled: boolean; visitorToken?: string;
}) {
  const { t } = useTranslation("simulator");
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [note, setNote] = useState(item?.note ?? "");
  const [options, setOptions] = useState(item?.options ?? (product.option_limit && product.options.length ? [product.options[0].option_uuid] : []));
  const [toppings, setToppings] = useState<Record<string, number>>(Object.fromEntries((item?.toppings ?? []).map((entry) => [entry.topping_uuid, entry.quantity])));
  const command = useSimulatorStore((state) => state.command);
  const invalid = !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999 ||
    Boolean(product.option_limit && product.options.length && (options.length < 1 || options.length > product.option_limit)) ||
    Boolean(product.topping_limit && Object.keys(toppings).length > product.topping_limit);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{product.name}</DialogTitle><DialogDescription>{t("options")} · {formatSimMoney(product.price)}</DialogDescription></DialogHeader>
      <SimField label={t("quantity")}><Input className="h-11" aria-label={t("quantity")} type="number" min={1} max={999} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></SimField>
      {product.options.length > 0 && <fieldset className="flex flex-col gap-3"><legend className="mb-2 text-sm font-medium">{t("options")}{product.option_limit ? ` (1–${product.option_limit})` : ""}</legend>
        {product.options.map((option) => <label key={option.option_uuid} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3"><Checkbox checked={options.includes(option.option_uuid)} onCheckedChange={(checked) => setOptions((current) => checked ? product.option_limit === 1 ? [option.option_uuid] : [...current, option.option_uuid] : current.filter((id) => id !== option.option_uuid))} />{option.name}</label>)}
      </fieldset>}
      {product.toppings.length > 0 && <fieldset className="flex flex-col gap-3"><legend className="mb-2 text-sm font-medium">{t("toppings")}{product.topping_limit ? ` (≤${product.topping_limit})` : ""}</legend>
        {product.toppings.map((topping) => <label key={topping.topping_uuid} className="flex min-h-11 items-center gap-3 rounded-lg border px-3"><Checkbox checked={Boolean(toppings[topping.topping_uuid])} onCheckedChange={(checked) => setToppings((current) => { const next = { ...current }; if (checked) next[topping.topping_uuid] = 1; else delete next[topping.topping_uuid]; return next; })} /><span className="min-w-0 flex-1">{topping.name}<span className="ml-2 text-xs text-muted-foreground">+{formatSimMoney(topping.price)}</span></span>
          {toppings[topping.topping_uuid] && <Input type="number" min={1} max={99} className="h-10 w-16" aria-label={`${t("quantity")} ${topping.name}`} value={toppings[topping.topping_uuid]} onChange={(event) => setToppings((current) => ({ ...current, [topping.topping_uuid]: Math.max(1, Math.min(99, Number(event.target.value) || 1)) }))} />}
        </label>)}
      </fieldset>}
      <SimField label={t("note")}><Textarea aria-label={t("note")} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></SimField>
      <DialogFooter><Button variant="outline" className="h-11" onClick={onClose}>{t("back")}</Button><Button className="h-11" disabled={disabled || invalid} onClick={async () => {
        const action = visitorToken ? item ? "visit_edit_item" : "visit_add_item" : item ? "edit_item" : "add_item";
        const success = await command(action, { ...(visitorToken ? { token: visitorToken } : { order_uuid: orderId }), ...(item ? { item_uuid: item.item_uuid } : { detail_uuid: product.detail_uuid }), quantity, note, options,
          toppings: Object.entries(toppings).map(([topping_uuid, count]) => ({ topping_uuid, quantity: count })) });
        if (success) onClose();
      }}>{t(item ? "edit" : "add")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
