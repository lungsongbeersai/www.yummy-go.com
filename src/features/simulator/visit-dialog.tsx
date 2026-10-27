"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { QrCode, ScanLine, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SimulatorItem, SimulatorProduct, SimulatorSession } from "@/services/simulator";
import { useSimulatorStore } from "@/stores/simulator-store";
import { SimConfirm } from "./confirmation";
import { SimField } from "./fields";
import { formatSimMoney, itemStatusLabel } from "./helpers";
import { ProductDialog } from "./product-dialog";

export function VisitDialog({ session, tableId, disabled, onClose }: {
  session: SimulatorSession; tableId: string; disabled: boolean; onClose: () => void;
}) {
  const { t } = useTranslation("simulator");
  const command = useSimulatorStore((state) => state.command);
  const visit = session.visits?.find((entry) => entry.table_uuid === tableId && entry.enabled);
  const activeVisit = session.visits?.find((entry) => entry.visit_uuid === session.active_visit_uuid && entry.enabled);
  const activeOrder = session.orders.find((order) => order.order_uuid === activeVisit?.order_uuid && order.status === "open");
  const [code, setCode] = useState(visit?.code ?? "");
  const [qr, setQr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<SimulatorProduct | null>(null);
  const [item, setItem] = useState<SimulatorItem | undefined>();
  useEffect(() => {
    let cancelled = false;
    if (visit?.token) {
      void import("qrcode").then((module) => module.toDataURL(visit.token, { margin: 2, width: 256 })).then((data) => { if (!cancelled) setQr(data); }).catch(() => { if (!cancelled) setQr(null); });
    }
    return () => { cancelled = true; };
  }, [visit?.token]);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle><QrCode className="mr-2 inline size-5" />{t("visits.title")}</DialogTitle><DialogDescription>{t("visits.help")}</DialogDescription></DialogHeader>
    <Tabs defaultValue="qr"><TabsList className="grid h-10 w-full grid-cols-2"><TabsTrigger value="qr">{t("visits.tableQR")}</TabsTrigger><TabsTrigger value="visitor">{t("visits.customerOrder")}</TabsTrigger></TabsList>
      <TabsContent value="qr" className="flex flex-col items-center gap-4 py-3">{visit ? <>
        {qr && <Image unoptimized src={qr} width={256} height={256} alt={t("visits.tableQR")} className="rounded-xl border" />}
        <p className="font-mono text-lg font-semibold tracking-wider">{visit.code}</p><p className="max-w-full break-all rounded-lg bg-muted p-3 font-mono text-[10px] text-muted-foreground">{visit.token}</p><Badge variant="secondary">{t("visits.scans")}: {visit.scan_count}</Badge>
        <SimConfirm title={t("visits.revoke")} description={t("visits.revokeHelp")} onConfirm={() => void command("visit_revoke", { table_uuid: tableId })}><Button className="h-11" variant="destructive" disabled={disabled}>{t("visits.revoke")}</Button></SimConfirm>
      </> : <><Alert><AlertDescription>{t("visits.inactive")}</AlertDescription></Alert><Button className="h-11" disabled={disabled} onClick={() => void command("visit_create", { table_uuid: tableId })}>{t("visits.create")}</Button></>}</TabsContent>
      <TabsContent value="visitor" className="flex flex-col gap-4 py-3"><form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void command("visit_scan", { token: code.trim() }); }}><div className="min-w-0 flex-1"><SimField label={t("visits.code")}><Input className="h-11" aria-label={t("visits.code")} value={code} onChange={(event) => setCode(event.target.value)} /></SimField></div><Button className="h-11" disabled={disabled || !code.trim()}><ScanLine />{t("visits.scan")}</Button></form>
        {activeVisit && activeOrder ? <><p className="text-sm font-medium">{session.tables.find((table) => table.table_uuid === activeVisit.table_uuid)?.name} · {activeVisit.code}</p><Input className="h-11" aria-label={t("search")} placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} /><div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">{session.catalog.filter((entry) => entry.supported && entry.customer_visible !== false && entry.name.toLowerCase().includes(search.toLowerCase())).map((entry) => <Button key={entry.detail_uuid} variant="outline" className="h-auto min-h-14 justify-between gap-2 whitespace-normal p-3 text-left" disabled={disabled} onClick={() => { setItem(undefined); setProduct(entry); }}><span>{entry.name}</span><span className="shrink-0 text-xs">{formatSimMoney(entry.price)}</span></Button>)}</div>
          <div className="flex flex-col gap-2 border-t pt-3">{activeOrder.items.filter((entry) => entry.status !== 9).map((entry) => <div key={entry.item_uuid} className="flex items-center gap-2 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="text-sm">{entry.quantity} × {entry.name}</p><p className="text-xs text-muted-foreground">{t(itemStatusLabel(entry.status))}</p></div>{entry.status === 0 && <><Button className="h-10" variant="outline" disabled={disabled} onClick={() => { const selected = session.catalog.find((candidate) => candidate.detail_uuid === entry.detail_uuid); if (selected) { setItem(entry); setProduct(selected); } }}>{t("edit")}</Button><SimConfirm title={t("cancelTitle")} description={t("cancelHelp")} onConfirm={() => void command("visit_delete_item", { token: activeVisit.token, item_uuid: entry.item_uuid })}><Button className="size-10" variant="destructive" aria-label={`${t("cancel")} ${entry.name}`} disabled={disabled}><Trash2 /></Button></SimConfirm></>}</div>)}</div>
          <Button className="h-11" disabled={disabled || !activeOrder.items.some((entry) => entry.status === 0)} onClick={() => void command("visit_submit", { token: activeVisit.token })}>{t("visits.submit")}</Button>
        </> : <Alert><AlertDescription>{t("visits.scanHelp")}</AlertDescription></Alert>}
      </TabsContent>
    </Tabs>
    {product && activeVisit && activeOrder && <ProductDialog product={product} item={item} orderId={activeOrder.order_uuid} visitorToken={activeVisit.token} disabled={disabled} onClose={() => { setProduct(null); setItem(undefined); }} />}
  </DialogContent></Dialog>;
}
