"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { commercialLineInput, commercialToday, commercialTotals, formatCommercialMoney, newCommercialLine, PLC_ISSUER, validCommercialDocument, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import { useCommercialLabels, type CommercialLabels } from "@/features/commercial/commercial.locale";
import type { CommercialDocumentType, CommercialParty, CreateCommercialDocumentInput } from "@/services/commercial";
import { useCommercialStore } from "@/stores/commercial-store";
import { useToastStore } from "@/stores/toast-store";
import { createMutationUuid } from "@/lib/pos/mutation-identity";

interface CommercialDocumentEditorProps { branchUuid: string; documentType: CommercialDocumentType; onClose: () => void }

export function CommercialDocumentEditor({ branchUuid, documentType, onClose }: CommercialDocumentEditorProps) {
  const l = useCommercialLabels();
  const catalog = useCommercialStore((state) => state.catalog);
  const catalogLoading = useCommercialStore((state) => state.catalogLoading);
  const createDocument = useCommercialStore((state) => state.createDocument);
  const saving = useCommercialStore((state) => state.saving);
  const error = useCommercialStore((state) => state.error);
  const showToast = useToastStore((state) => state.show);
  const [customer, setCustomer] = useState<CommercialParty>({ name: "" });
  const [issuer, setIssuer] = useState<CommercialParty>({ ...PLC_ISSUER });
  const [issuedOn, setIssuedOn] = useState(commercialToday);
  const [validUntil, setValidUntil] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [showImages, setShowImages] = useState(true);
  const [taxRate, setTaxRate] = useState<0 | 10>(0);
  const [lines, setLines] = useState<CommercialDraftLine[]>([]);
  const [removeLine, setRemoveLine] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [requestUuid] = useState(createMutationUuid);
  const totals = commercialTotals(lines, taxRate);
  const activeCatalog = catalog.filter((item) => item.active);

  function changeLine(key: string, patch: Partial<CommercialDraftLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const input: CreateCommercialDocumentInput = {
      request_uuid: requestUuid, branch_uuid: branchUuid, document_type: documentType, issued_on: issuedOn,
      ...(documentType === "quotation" ? { valid_until: validUntil || null } : { payment_method: paymentMethod }),
      customer, issuer, notes, show_images: showImages, tax_rate: taxRate, items: lines.map(commercialLineInput),
    };
    if (!validCommercialDocument(input)) { setValidation(l("documentRequired")); return; }
    setValidation(null);
    try {
      const document = await createDocument(input);
      if (!document) return;
      showToast({ title: l("saved"), description: document.number, tone: "success" });
      onClose();
    } catch {
      // Keep the draft and server error visible so the user can correct it.
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="font-lao sm:max-w-5xl" showCloseButton={!saving}>
        <DialogHeader><DialogTitle>{l(documentType === "quotation" ? "newQuotation" : "newReceipt")}</DialogTitle><DialogDescription>{l("immutableHint")}</DialogDescription></DialogHeader>
        <form className="grid min-w-0 gap-6" onSubmit={submit}>
          {validation || error ? <Alert variant="destructive"><AlertDescription>{validation || error}</AlertDescription></Alert> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="commercial-issued-on">{l("issuedOn")} *</FieldLabel><Input id="commercial-issued-on" type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} required min="2000-01-01" max="2199-12-31" disabled={saving} /></Field>
            {documentType === "quotation" ? <Field><FieldLabel htmlFor="commercial-valid-until">{l("validUntil")}</FieldLabel><Input id="commercial-valid-until" type="date" value={validUntil} min={issuedOn} max="2199-12-31" onChange={(event) => setValidUntil(event.target.value)} disabled={saving} /></Field> : <CommercialPaymentField value={paymentMethod} onChange={setPaymentMethod} disabled={saving} l={l} />}
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PartyFields id="commercial-customer" title={l("customer")} value={customer} onChange={setCustomer} disabled={saving} l={l} />
            <PartyFields id="commercial-issuer" title={l("issuer")} value={issuer} onChange={setIssuer} disabled={saving} l={l} issuer />
          </div>
          <section className="grid min-w-0 gap-3" aria-label={l("items")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold">{l("items")} ({lines.length})</h2><label className="flex min-h-11 cursor-pointer items-center gap-3"><Switch checked={showImages} onCheckedChange={setShowImages} disabled={saving} /><span>{l("showImages")}</span></label></div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Select value="" disabled={saving || catalogLoading || !activeCatalog.length || lines.length >= 100} onValueChange={(value) => { const item = activeCatalog.find((row) => row.item_uuid === value); if (item) setLines((current) => [...current, newCommercialLine(item)]); }}>
                <SelectTrigger className="h-11 w-full min-w-0 sm:flex-1" aria-label={l("chooseItem")}><SelectValue placeholder={l("chooseItem")} /></SelectTrigger><SelectContent>{activeCatalog.map((item) => <SelectItem key={item.item_uuid} value={item.item_uuid} className="min-h-11"><span className="max-w-64 truncate">{item.name} · {formatCommercialMoney(item.unit_price)}</span></SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" className="min-h-11" disabled={saving || lines.length >= 100} onClick={() => setLines((current) => [...current, newCommercialLine()])}><Plus />{l("customLine")}</Button>
            </div>
            {!lines.length ? <p className="rounded-md border border-dashed p-5 text-center text-muted-foreground">{l("chooseItem")}</p> : null}
            {lines.map((line, index) => <div key={line.key} className="grid min-w-0 gap-3 rounded-lg border bg-card p-3 sm:p-4">
              <div className="flex min-w-0 items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">{index + 1}</span><Field className="min-w-0 flex-1"><FieldLabel htmlFor={`${line.key}-name`}>{l("name")} *</FieldLabel><Input id={`${line.key}-name`} value={line.name} maxLength={250} required disabled={saving} onChange={(event) => changeLine(line.key, { name: event.target.value })} /></Field><Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`${l("removeLine")} ${index + 1}`} disabled={saving} onClick={() => setRemoveLine(line.key)}><Trash2 /></Button></div>
              <Field><FieldLabel htmlFor={`${line.key}-description`}>{l("description")}</FieldLabel><Textarea id={`${line.key}-description`} value={line.description} maxLength={3000} disabled={saving} onChange={(event) => changeLine(line.key, { description: event.target.value })} /></Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Field><FieldLabel htmlFor={`${line.key}-quantity`}>{l("quantity")} *</FieldLabel><Input id={`${line.key}-quantity`} type="number" inputMode="decimal" min="0.001" max="999999.999" step="0.001" value={line.quantity} required disabled={saving} onChange={(event) => changeLine(line.key, { quantity: event.target.value })} /></Field><Field><FieldLabel htmlFor={`${line.key}-unit`}>{l("unit")}</FieldLabel><Input id={`${line.key}-unit`} value={line.unit} maxLength={60} disabled={saving} onChange={(event) => changeLine(line.key, { unit: event.target.value })} /></Field><Field><FieldLabel htmlFor={`${line.key}-price`}>{l("price")} *</FieldLabel><Input id={`${line.key}-price`} type="number" inputMode="numeric" min="0" step="1" value={line.unit_price} required disabled={saving} onChange={(event) => changeLine(line.key, { unit_price: event.target.value })} /></Field></div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{line.image_url ? <label className="flex min-h-11 cursor-pointer items-center gap-3"><Switch checked={line.show_image} onCheckedChange={(checked) => changeLine(line.key, { show_image: checked })} disabled={saving} /><span className="text-xs">{l("showItemImage")}</span></label> : <span />}<p className="text-right font-semibold tabular-nums">{formatCommercialMoney(commercialTotals([line], 0).subtotal)} {l("lak")}</p></div>
            </div>)}
          </section>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2"><Field><FieldLabel htmlFor="commercial-notes">{l("notes")}</FieldLabel><Textarea id="commercial-notes" className="min-h-28" value={notes} maxLength={5000} disabled={saving} onChange={(event) => setNotes(event.target.value)} /></Field><div className="grid content-start gap-3 rounded-lg border bg-muted/40 p-4"><div className="flex justify-between gap-3"><span>{l("subtotal")}</span><span className="tabular-nums">{formatCommercialMoney(totals.subtotal)}</span></div><Field orientation="horizontal" className="justify-between"><FieldLabel htmlFor="commercial-tax">{l("tax")}</FieldLabel><Select value={String(taxRate)} onValueChange={(value) => setTaxRate(value === "10" ? 10 : 0)} disabled={saving}><SelectTrigger id="commercial-tax" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">{l("noTax")}</SelectItem><SelectItem value="10">10%</SelectItem></SelectContent></Select></Field><div className="flex justify-between gap-3 text-muted-foreground"><span>{l("tax")}</span><span className="tabular-nums">{formatCommercialMoney(totals.taxAmount)}</span></div><div className="flex justify-between gap-3 border-t pt-3 text-base font-semibold"><span>{l("total")}</span><span className="tabular-nums">{formatCommercialMoney(totals.total)} {l("lak")}</span></div></div></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={saving}>{l("close")}</Button><Button type="submit" disabled={saving || !lines.length}>{l(saving ? "saving" : "saveDocument")}</Button></DialogFooter>
        </form>
        <AlertDialog open={Boolean(removeLine)} onOpenChange={(open) => { if (!open) setRemoveLine(null); }}><AlertDialogContent className="font-lao"><AlertDialogHeader><AlertDialogTitle>{l("removeLine")}</AlertDialogTitle><AlertDialogDescription>{l("removeLineConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{l("cancel")}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setLines((current) => current.filter((line) => line.key !== removeLine)); setRemoveLine(null); }}>{l("remove")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

interface PartyFieldsProps { id: string; title: string; value: CommercialParty; onChange: (value: CommercialParty) => void; disabled: boolean; l: CommercialLabels; issuer?: boolean }

function PartyFields({ id, title, value, onChange, disabled, l, issuer }: PartyFieldsProps) {
  return <fieldset className="grid min-w-0 content-start gap-3 rounded-lg border p-4"><legend className="px-1 font-semibold">{title}</legend><Field><FieldLabel htmlFor={`${id}-name`}>{l("companyName")} *</FieldLabel><Input id={`${id}-name`} value={value.name} required maxLength={250} disabled={disabled} onChange={(event) => onChange({ ...value, name: event.target.value })} /></Field><Field><FieldLabel htmlFor={`${id}-address`}>{l("address")}</FieldLabel><Textarea id={`${id}-address`} value={value.address ?? ""} maxLength={1500} disabled={disabled} onChange={(event) => onChange({ ...value, address: event.target.value })} /></Field><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor={`${id}-phone`}>{l("phone")}</FieldLabel><Input id={`${id}-phone`} type="tel" value={value.phone ?? ""} maxLength={100} disabled={disabled} onChange={(event) => onChange({ ...value, phone: event.target.value })} /></Field><Field><FieldLabel htmlFor={`${id}-tax`}>{l("taxId")}</FieldLabel><Input id={`${id}-tax`} value={value.tax_id ?? ""} maxLength={100} disabled={disabled} onChange={(event) => onChange({ ...value, tax_id: event.target.value })} /></Field></div>{issuer ? <><Field><FieldLabel htmlFor={`${id}-bank`}>{l("bankDetails")}</FieldLabel><Textarea id={`${id}-bank`} value={value.bank_details ?? ""} maxLength={1500} disabled={disabled} onChange={(event) => onChange({ ...value, bank_details: event.target.value })} /></Field><Field><FieldLabel htmlFor={`${id}-logo`}>{l("logoUrl")}</FieldLabel><Input id={`${id}-logo`} value={value.logo_url ?? ""} maxLength={2000} disabled={disabled} onChange={(event) => onChange({ ...value, logo_url: event.target.value || null })} /></Field></> : null}</fieldset>;
}

interface CommercialPaymentFieldProps { value: string; onChange: (value: string) => void; disabled: boolean; l: CommercialLabels }

export function CommercialPaymentField({ value, onChange, disabled, l }: CommercialPaymentFieldProps) {
  return <Field><FieldLabel htmlFor="commercial-payment-method">{l("paymentMethod")} *</FieldLabel><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id="commercial-payment-method" className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">{l("cash")}</SelectItem><SelectItem value="transfer">{l("transfer")}</SelectItem><SelectItem value="other">{l("otherPayment")}</SelectItem></SelectContent></Select></Field>;
}
