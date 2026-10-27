"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SimulatorItem } from "@/services/simulator";
import { useSimulatorStore } from "@/stores/simulator-store";
import { SimConfirm } from "./confirmation";
import { SimField } from "./fields";

export function CancelItemDialog({ item, orderId, disabled }: { item: SimulatorItem; orderId: string; disabled: boolean }) {
  const { t } = useTranslation("simulator");
  const command = useSimulatorStore((state) => state.command);
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity);
  const valid = Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= item.quantity;
  return <><Button aria-label={`${t("cancel")} ${item.name}`} size="icon" className="size-10" variant="destructive" disabled={disabled} onClick={() => { setQuantity(item.quantity); setOpen(true); }}><Trash2 /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{t("cancelTitle")}</DialogTitle><DialogDescription>{item.name} · {t("cancelHelp")}</DialogDescription></DialogHeader>
      <SimField label={t("quantity")}><Input className="h-11" type="number" aria-label={t("quantity")} min={1} max={item.quantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></SimField>
      <DialogFooter><Button className="h-11" variant="outline" onClick={() => setOpen(false)}>{t("back")}</Button><SimConfirm title={t("cancelTitle")} description={`${quantity} × ${item.name}`} disabled={disabled || !valid} onConfirm={async () => { if (await command("cancel_item", { order_uuid: orderId, item_uuid: item.item_uuid, quantity })) setOpen(false); }}><Button className="h-11" variant="destructive" disabled={disabled || !valid}>{t("cancel")}</Button></SimConfirm></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
