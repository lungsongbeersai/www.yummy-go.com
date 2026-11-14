"use client";

import { useState } from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CommercialPaymentField } from "@/features/commercial/commercial-document-editor";
import { commercialToday, formatCommercialMoney } from "@/features/commercial/commercial-domain";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import type { CommercialDocument, CommercialDocumentType } from "@/services/commercial";
import { useCommercialStore } from "@/stores/commercial-store";
import { useToastStore } from "@/stores/toast-store";

interface CommercialHistoryProps { documentType: CommercialDocumentType; onCreate: () => void }

export function CommercialHistory({ documentType, onCreate }: CommercialHistoryProps) {
  const l = useCommercialLabels();
  const documents = useCommercialStore((state) => state.documents);
  const loading = useCommercialStore((state) => state.documentsLoading);
  const detailLoading = useCommercialStore((state) => state.loading);
  const saving = useCommercialStore((state) => state.saving);
  const error = useCommercialStore((state) => state.documentsError);
  const load = useCommercialStore((state) => state.loadDocuments);
  const openDocument = useCommercialStore((state) => state.openDocument);
  const clearError = useCommercialStore((state) => state.clearError);
  const [search, setSearch] = useState("");
  const [conversion, setConversion] = useState<CommercialDocument | null>(null);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const rows = documents.filter((document) => document.document_type === documentType && `${document.number} ${document.customer.name}`.toLocaleLowerCase().includes(normalizedSearch)).sort((left, right) => right.created_at.localeCompare(left.created_at));
  const disabled = loading || detailLoading || saving;

  function view(documentUuid: string) { void openDocument(documentUuid).catch(() => {}); }

  return <section className="grid gap-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Input className="h-11 sm:max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`${l("number")} / ${l("customer")}`} aria-label={`${l("number")} / ${l("customer")}`} /><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => { void load().catch(() => {}); }} disabled={disabled}><RefreshCw />{l("refresh")}</Button><Button className="min-h-11" onClick={onCreate} disabled={saving}><Plus />{l(documentType === "quotation" ? "newQuotation" : "newReceipt")}</Button></div></div>
    {error ? <Alert variant="destructive"><AlertDescription>{error}<Button variant="outline" disabled={loading} onClick={() => { void load().catch(() => {}); }}>{l("retry")}</Button></AlertDescription></Alert> : null}
    {loading ? <div className="grid gap-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-32 rounded-lg" />)}</div> : rows.length ? <div className="grid gap-3">{rows.map((document) => <Card key={document.document_uuid}><CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="grid min-w-0 flex-1 gap-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-all font-semibold">{document.number}</h2>{document.source_quotation_uuid ? <Badge variant="secondary">{l("linkedQuotation")}</Badge> : null}</div><p className="break-words">{document.customer.name}</p><p className="text-xs text-muted-foreground">{l("issuedOn")}: {document.issued_on}</p></div><p className="text-lg font-semibold tabular-nums">{formatCommercialMoney(document.total)} <span className="text-xs font-normal">{l("lak")}</span></p><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => view(document.document_uuid)} disabled={disabled}>{l("viewDocument")}</Button>{documentType === "quotation" ? <Button className="min-h-11" variant={document.receipt_uuid ? "secondary" : "default"} disabled={disabled} onClick={() => { if (document.receipt_uuid) view(document.receipt_uuid); else { clearError(); setConversion(document); } }}>{l(document.receipt_uuid ? "viewReceipt" : "createReceipt")}</Button> : null}</div></CardContent></Card>)}</div> : !error ? <Empty className="min-h-64 border"><EmptyHeader><EmptyMedia variant="icon"><FileText /></EmptyMedia><EmptyTitle>{l(search ? "noResults" : "emptyDocuments")}</EmptyTitle><EmptyDescription>{l("emptyDocumentsHint")}</EmptyDescription></EmptyHeader><Button className="min-h-11" onClick={onCreate}><Plus />{l(documentType === "quotation" ? "newQuotation" : "newReceipt")}</Button></Empty> : null}
    {conversion ? <QuotationReceiptDialog document={conversion} onClose={() => setConversion(null)} /> : null}
  </section>;
}

interface QuotationReceiptDialogProps { document: CommercialDocument; onClose: () => void }

function QuotationReceiptDialog({ document, onClose }: QuotationReceiptDialogProps) {
  const l = useCommercialLabels();
  const convert = useCommercialStore((state) => state.convertQuotation);
  const saving = useCommercialStore((state) => state.saving);
  const error = useCommercialStore((state) => state.error);
  const showToast = useToastStore((state) => state.show);
  const [issuedOn, setIssuedOn] = useState(commercialToday);
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState(document.notes ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !issuedOn) return;
    try {
      const receipt = await convert({ branch_uuid: document.branch_uuid, document_uuid: document.document_uuid, issued_on: issuedOn, payment_method: method, notes });
      if (!receipt) return;
      showToast({ title: l("saved"), description: receipt.number, tone: "success" });
      onClose();
    } catch {
      // Conversion errors stay in the store and leave the payment fields intact.
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent className="font-lao sm:max-w-xl" showCloseButton={!saving}><DialogHeader><DialogTitle>{l("createReceipt")} · {document.number}</DialogTitle><DialogDescription>{l("receiptHint")}</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={submit}>{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}<p className="text-base font-semibold">{document.customer.name} · {formatCommercialMoney(document.total)} {l("lak")}</p><Field><FieldLabel htmlFor="commercial-receipt-date">{l("issuedOn")}</FieldLabel><Input id="commercial-receipt-date" type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} required disabled={saving} /></Field><CommercialPaymentField value={method} onChange={setMethod} disabled={saving} l={l} /><Field><FieldLabel htmlFor="commercial-receipt-notes">{l("notes")}</FieldLabel><Textarea id="commercial-receipt-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} disabled={saving} /></Field><DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>{l("close")}</Button><Button type="submit" disabled={saving}>{l(saving ? "saving" : "createReceipt")}</Button></DialogFooter></form></DialogContent></Dialog>;
}
