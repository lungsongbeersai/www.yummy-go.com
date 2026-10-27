"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChefHat, Check, Printer, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SimulatorOrder, SimulatorSession } from "@/services/simulator";
import { useSimulatorStore } from "@/stores/simulator-store";
import { SimConfirm } from "./confirmation";
import { formatSimMoney, orderName } from "./helpers";
import { DepositsPanel } from "./deposits-panel";

export function ServicePanels({ session, disabled }: { session: SimulatorSession; disabled: boolean }) {
  const { t } = useTranslation("simulator");
  const command = useSimulatorStore((state) => state.command);
  const [receipt, setReceipt] = useState<SimulatorOrder | null>(null);
  const jobs = session.kitchen.filter((job) => job.status !== "served");
  return <>
    <Tabs defaultValue="kitchen" className="min-w-0 gap-1 border-t bg-card px-4 pb-3 pt-2">
      <TabsList variant="line" className="h-10 max-w-full justify-start overflow-x-auto"><TabsTrigger value="kitchen"><ChefHat />{t("kitchen")} <Badge variant="secondary">{jobs.length}</Badge></TabsTrigger><TabsTrigger value="timeline">{t("timeline")}</TabsTrigger><TabsTrigger value="history"><Receipt />{t("history")}</TabsTrigger><TabsTrigger value="sales">{t("sales")}</TabsTrigger><TabsTrigger value="deposits">{t("deposits.title")}</TabsTrigger></TabsList>
      <TabsContent value="kitchen" className="m-0 max-h-48 overflow-y-auto py-2">{!jobs.length ? <Empty className="min-h-24 p-3"><EmptyHeader><EmptyTitle>{t("noKitchen")}</EmptyTitle></EmptyHeader></Empty> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{jobs.map((job) => {
        const order = session.orders.find((entry) => entry.order_uuid === job.order_uuid);
        return <article key={job.job_uuid} className="rounded-xl border p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="font-semibold">{job.table_name}</p><Badge variant="secondary">{t(job.status)}</Badge></div>
          <div className="mb-3 flex flex-col gap-1">{job.item_uuids.map((id) => { const item = order?.items.find((entry) => entry.item_uuid === id); return item ? <p key={id} className="text-xs text-muted-foreground">{item.quantity} × {item.name}</p> : null; })}</div>
          <p className={job.print_status === "failed" ? "mb-2 text-xs text-destructive" : "mb-2 text-xs text-muted-foreground"}><Printer className="mr-1 inline size-3" />{job.print_status === "failed" ? t("printFailed") : job.printer_names.join(", ") || t("noPrinter")} · {t("printAttempts")}: {job.attempts}</p>
          <div className="flex flex-wrap gap-2">{job.print_status === "failed" ? <Button className="h-10" variant="outline" disabled={disabled} onClick={() => void command("printer_retry", { job_uuid: job.job_uuid })}>{t("retryPrint")}</Button> : <Button className="h-10" disabled={disabled} onClick={() => void command(job.status === "preparing" ? "kitchen_ready" : "serve", { job_uuid: job.job_uuid })}><Check />{t(job.status === "preparing" ? "markReady" : "serve")}</Button>}
            {job.status === "preparing" && job.print_status === "success" && <SimConfirm title={t("failPrint")} description={job.printer_names.join(", ")} onConfirm={() => void command("printer_fail", { job_uuid: job.job_uuid })}><Button className="h-10" variant="ghost" disabled={disabled}>{t("failPrint")}</Button></SimConfirm>}
          </div>
        </article>;
      })}</div>}</TabsContent>
      <TabsContent value="timeline" className="m-0 max-h-48 overflow-y-auto py-2"><ol className="flex flex-col gap-2">{session.activity.slice(0, 30).map((event) => <li key={event.event_uuid} className="flex items-baseline gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs"><time className="shrink-0 font-mono text-muted-foreground">{new Date(event.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><span>{event.message}</span></li>)}</ol>{!session.activity.length && <p className="p-4 text-sm text-muted-foreground">{t("noActivity")}</p>}</TabsContent>
      <TabsContent value="history" className="m-0 max-h-48 overflow-y-auto py-2"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{session.orders.filter((order) => order.status === "paid").map((order) => <Button key={order.order_uuid} variant="outline" className="h-auto min-h-18 justify-between gap-3 p-3 text-left" onClick={() => setReceipt(order)}><div><p className="font-medium">{orderName(order, session)}</p><p className="mt-1 text-xs text-muted-foreground">{order.customer_name} · {order.receipt?.receipt_number}</p></div><span className="font-semibold tabular-nums">{formatSimMoney(order.totals.total)}</span></Button>)}</div>{!session.sales.bills && <p className="p-4 text-sm text-muted-foreground">{t("noHistory")}</p>}</TabsContent>
      <TabsContent value="sales" className="m-0 py-3"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ label: "sales", value: formatSimMoney(session.sales.total) }, { label: "closedBills", value: session.sales.bills }, { label: "activeBills", value: session.orders.filter((order) => order.status === "open").length }, { label: "guests", value: session.sales.guests }].map((metric) => <div key={metric.label} className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{t(metric.label)}</p><p className="mt-2 text-xl font-semibold tabular-nums">{metric.value}</p></div>)}</div></TabsContent>
      <TabsContent value="deposits" className="m-0 max-h-48 overflow-y-auto py-3"><DepositsPanel session={session} disabled={disabled} /></TabsContent>
    </Tabs>
    <Dialog open={Boolean(receipt)} onOpenChange={(open) => { if (!open) setReceipt(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{t("receipt")}</DialogTitle><DialogDescription>{t("simulated")}</DialogDescription></DialogHeader>{receipt && <div className="flex flex-col gap-4 font-mono text-sm"><div className="border-b pb-3 text-center"><p className="font-semibold">{session.config.store_name}</p><p>{session.config.branch_name}</p><p>{receipt.receipt?.receipt_number}</p><p className="text-xs">{receipt.receipt?.at && new Date(receipt.receipt.at).toLocaleString()}</p></div>
      <div>{receipt.items.filter((item) => item.status !== 9).map((item) => <div key={item.item_uuid} className="flex justify-between gap-4 py-1"><span>{item.quantity} × {item.name}</span><span>{formatSimMoney(item.quantity * item.unit_price)}</span></div>)}</div>
      <div className="flex flex-col gap-1 border-y py-3">{(["subtotal", "item_discount", "bill_discount", "service", "vat", "total"] as const).map((key) => <div key={key} className="flex justify-between"><span>{t(({ item_discount: "itemDiscount", bill_discount: "billDiscount" } as Record<string, string>)[key] ?? key)}</span><span>{formatSimMoney(receipt.totals[key])}</span></div>)}</div>
      {(receipt.redemptions ?? []).map((entry) => <div key={entry.withdrawal_uuid} className="flex justify-between gap-4 text-xs"><span>{t("deposits.withdraw")}: {entry.quantity} × {entry.product_name}</span><span>0 LAK</span></div>)}
      {receipt.payments.map((payment) => <div key={payment.payment_uuid} className="flex justify-between gap-3"><span>{t(payment.method)}{payment.change_lak ? ` · +${formatSimMoney(payment.change_lak)}` : ""}</span><span>{formatSimMoney(payment.amount, "en", payment.currency)}</span></div>)}
    </div>}</DialogContent></Dialog>
  </>;
}
