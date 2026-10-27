"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import type { SimulatorDeposit, SimulatorSession } from "@/services/simulator";
import { useSimulatorStore } from "@/stores/simulator-store";
import { SimField, SimSelect } from "./fields";
import { orderName } from "./helpers";

export function DepositsPanel({ session, disabled }: { session: SimulatorSession; disabled: boolean }) {
  const { t } = useTranslation("simulator");
  const command = useSimulatorStore((state) => state.command);
  const [dialog, setDialog] = useState<"customer" | "deposit" | "withdraw" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memberCode, setMemberCode] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [product, setProduct] = useState("");
  const [bill, setBill] = useState("none");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [deposit, setDeposit] = useState<SimulatorDeposit | null>(null);
  const profiles = session.profiles ?? [];
  const deposits = session.deposits ?? [];
  const close = () => { setDialog(null); setName(""); setPhone(""); setMemberCode(""); setEditingCustomer(null); setQuantity(1); setNote(""); setBill("none"); setDeposit(null); };
  const valid = dialog === "customer" ? name.trim().length > 0 : Number.isFinite(quantity) && quantity >= 0.001 &&
    (dialog === "deposit" ? Boolean(customer && product) : quantity <= (deposit?.remaining_qty ?? 0));
  const submit = async () => {
    const type = dialog === "customer" ? editingCustomer ? "customer_update" : "customer_create" : dialog === "deposit" ? "deposit_create" : "deposit_withdraw";
    const payload = dialog === "customer" ? { name, phone, member_code: memberCode, ...(editingCustomer ? { customer_uuid: editingCustomer } : {}) } : dialog === "deposit" ?
      { customer_uuid: customer, items: [{ detail_uuid: product, quantity }], note, ...(bill !== "none" ? { order_uuid: bill } : {}) } :
      { deposit_uuid: deposit?.deposit_uuid, quantity, note, ...(bill !== "none" ? { order_uuid: bill } : {}) };
    if (await command(type, payload)) close();
  };
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{t("deposits.help")}</p><div className="flex gap-2"><Button className="h-10" variant="outline" disabled={disabled} onClick={() => setDialog("customer")}><Users />{t("deposits.newCustomer")}</Button><Button className="h-10" disabled={disabled || !profiles.length || !session.config.deposit_expire_days} onClick={() => setDialog("deposit")}><Plus />{t("deposits.create")}</Button></div></div>
    {!session.config.deposit_expire_days && <p className="text-xs text-muted-foreground">{t("deposits.notConfigured")}</p>}
    <div className="flex flex-wrap gap-2">{profiles.map((profile) => <Button key={profile.customer_uuid} variant="outline" className="h-10 gap-2 px-3 py-2" disabled={disabled} aria-label={`${t("deposits.editCustomer")} ${profile.name}`} onClick={() => { setEditingCustomer(profile.customer_uuid); setName(profile.name); setPhone(profile.phone); setMemberCode(profile.member_code ?? ""); setDialog("customer"); }}><Users className="size-3" />{profile.name}{profile.phone ? ` · ${profile.phone}` : ""}</Button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{deposits.map((entry) => <article key={entry.deposit_uuid} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{entry.customer_name}</p><Badge variant="secondary">{t(`deposits.${entry.status}`)}</Badge></div><p className="mt-2 text-sm">{entry.product_name}</p><p className="mt-1 text-xs text-muted-foreground">{entry.remaining_qty} / {entry.deposit_qty} · {t("deposits.expires")}: {entry.expire_date}</p><p className="mt-1 text-[10px] text-muted-foreground">{entry.deposit_no}</p>{entry.status === "ACTIVE" && <Button className="mt-3 h-10" variant="outline" disabled={disabled} onClick={() => { setDeposit(entry); setDialog("withdraw"); }}>{t("deposits.withdraw")}</Button>}</article>)}</div>
    {!deposits.length && <Empty className="p-4"><EmptyHeader><EmptyTitle>{t("deposits.empty")}</EmptyTitle></EmptyHeader></Empty>}
    {(session.deposit_withdrawals ?? []).length > 0 && <div className="border-t pt-3"><h3 className="mb-2 text-xs font-medium text-muted-foreground">{t("deposits.withdrawals")}</h3><div className="flex flex-col gap-1">{session.deposit_withdrawals?.slice().reverse().map((entry) => <p key={entry.withdrawal_uuid} className="text-xs text-muted-foreground">{entry.customer_name} · {entry.quantity} × {entry.product_name} · {new Date(entry.at).toLocaleString()}</p>)}</div></div>}
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{t(dialog === "customer" ? "deposits.newCustomer" : dialog === "withdraw" ? "deposits.withdraw" : "deposits.create")}</DialogTitle><DialogDescription>{t("deposits.help")}</DialogDescription></DialogHeader>
      {dialog === "customer" ? <><SimField label={t("customer")}><Input aria-label={t("customer")} className="h-11" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></SimField><SimField label={t("deposits.phone")}><Input aria-label={t("deposits.phone")} className="h-11" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></SimField><SimField label={t("deposits.memberCode")}><Input aria-label={t("deposits.memberCode")} className="h-11" maxLength={50} value={memberCode} onChange={(event) => setMemberCode(event.target.value)} /></SimField></> : <>
        {dialog === "deposit" ? <><SimField label={t("customer")}><SimSelect label={t("customer")} value={customer} onChange={setCustomer} options={profiles.map((profile) => ({ value: profile.customer_uuid, label: profile.name }))} /></SimField><SimField label={t("menu")}><SimSelect label={t("menu")} value={product} onChange={setProduct} options={session.catalog.filter((entry) => entry.supported).map((entry) => ({ value: entry.detail_uuid, label: entry.name }))} /></SimField></> : <p className="rounded-lg bg-muted p-3 text-sm">{deposit?.customer_name} · {deposit?.product_name} · {deposit?.remaining_qty}</p>}
        <SimField label={t("quantity")}><Input aria-label={t("quantity")} className="h-11" type="number" step="0.001" min={0.001} max={dialog === "withdraw" ? deposit?.remaining_qty : 999} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></SimField>
        <SimField label={t("deposits.linkBill")}><SimSelect label={t("deposits.linkBill")} value={bill} onChange={setBill} options={[{ value: "none", label: t("none") }, ...session.orders.filter((order) => dialog === "withdraw" ? order.status === "open" : ["open", "paid"].includes(order.status)).map((order) => ({ value: order.order_uuid, label: `${orderName(order, session)} · ${order.customer_name}` }))]} /></SimField>
        <SimField label={t("note")}><Input aria-label={t("note")} className="h-11" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></SimField>
      </>}
      <DialogFooter><Button className="h-11" variant="outline" onClick={close}>{t("back")}</Button><Button className="h-11" disabled={disabled || !valid} onClick={() => void submit()}>{t("confirmAction")}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
