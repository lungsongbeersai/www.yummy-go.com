"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { commercialCreateHref, commercialEditHref } from "@/features/commercial/commercial-routes";
import { internalRoute } from "@/lib/routes";
import { History, MoreHorizontal, Pencil, Plus, ReceiptText, RefreshCw, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommercialPaymentField } from "@/features/commercial/commercial-document-editor";
import { commercialCurrencyLabelKey, commercialToday, formatCommercialMoney } from "@/features/commercial/commercial-domain";
import { useCommercialLabels, type CommercialLabels } from "@/features/commercial/commercial.locale";
import type { CommercialDocument, CommercialDocumentType } from "@/services/commercial";
import { useCommercialStore } from "@/stores/commercial-store";
import { useToastStore } from "@/stores/toast-store";

interface CommercialHistoryProps { documentType: CommercialDocumentType }

export function CommercialHistory({ documentType }: CommercialHistoryProps) {
  const l = useCommercialLabels();
  const documents = useCommercialStore((state) => state.documents);
  const loading = useCommercialStore((state) => state.documentsLoading);
  const detailLoading = useCommercialStore((state) => state.loading);
  const saving = useCommercialStore((state) => state.saving);
  const error = useCommercialStore((state) => state.documentsError);
  const load = useCommercialStore((state) => state.loadDocuments);
  const openDocument = useCommercialStore((state) => state.openDocument);
  const storeUuid = useCommercialStore((state) => state.storeUuid);
  const branchUuid = useCommercialStore((state) => state.branchUuid);
  const openRevisions = useCommercialStore((state) => state.openRevisions);
  const clearError = useCommercialStore((state) => state.clearError);
  const [search, setSearch] = useState("");
  const [conversion, setConversion] = useState<CommercialDocument | null>(null);
  const createHref = internalRoute(commercialCreateHref({ storeUuid, branchUuid }, documentType));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const rows = documents.filter((document) => document.document_type === documentType && `${document.number} ${document.customer.name}`.toLocaleLowerCase().includes(normalizedSearch)).sort((left, right) => right.created_at.localeCompare(left.created_at));
  const disabled = loading || detailLoading || saving;

  function view(documentUuid: string) { void openDocument(documentUuid).catch(() => {}); }

  function status(document: CommercialDocument) {
    const hasReceipt = document.document_type === "quotation" && Boolean(document.receipt_uuid);
    return <Badge variant="outline" className={`h-auto min-h-6 max-w-full rounded-md px-2 text-center text-xs font-normal whitespace-normal ${hasReceipt ? "border-primary-text/20 bg-primary/10 text-primary-text" : "text-muted-foreground"}`}>{l(hasReceipt ? "receiptIssued" : "issued")}</Badge>;
  }

  function actions(document: CommercialDocument) {
    return <CommercialHistoryActions document={document} l={l} disabled={disabled}
      editHref={commercialEditHref({ storeUuid, branchUuid }, document.document_uuid)}
      onRevisions={() => { void openRevisions(document.document_uuid).catch(() => {}); }}
      onReceipt={documentType === "quotation" ? () => { if (document.receipt_uuid) view(document.receipt_uuid); else { clearError(); setConversion(document); } } : undefined} />;
  }

  function documentLink(document: CommercialDocument) {
    return <Button type="button" variant="link" className="h-auto min-h-11 max-w-full justify-start px-0 py-1 text-left font-medium whitespace-normal" disabled={disabled} onClick={() => view(document.document_uuid)} aria-label={`${l("openDocument")} ${document.number}`}><span className="break-all">{document.number}</span></Button>;
  }

  function source(document: CommercialDocument) {
    return document.source_quotation_version ? <p className="mt-1 whitespace-normal text-xs leading-relaxed text-muted-foreground">{l("sourceQuotationVersion")} {document.source_quotation_number || ""} · {l("version")} {document.source_quotation_version}</p> : null;
  }

  return <section className="grid min-w-0 gap-3">
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 sm:w-full sm:max-w-md"><Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" /><Input className="h-11 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={l("searchDocuments")} aria-label={l("searchDocuments")} /></div>
      <div className="flex shrink-0 gap-2"><Button type="button" variant="outline" size="icon" className="size-11 shrink-0" title={l("refresh")} aria-label={l("refresh")} onClick={() => { void load().catch(() => {}); }} disabled={disabled}><RefreshCw className="size-4" /></Button><Button asChild className="min-h-11 flex-1 sm:flex-none"><Link href={createHref}><Plus />{l(documentType === "quotation" ? "newQuotation" : "newReceipt")}</Link></Button></div>
    </div>
    {error ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center gap-2">{error}<Button type="button" variant="outline" className="min-h-11" disabled={loading} onClick={() => { void load().catch(() => {}); }}>{l("retry")}</Button></AlertDescription></Alert> : null}
    {loading ? <div className="overflow-hidden rounded-lg border border-border bg-card">{Array.from({ length: 4 }, (_, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_6rem] gap-4 border-b border-border p-4 last:border-0"><div className="grid gap-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-48 max-w-full" /></div><Skeleton className="h-5 w-full self-center" /></div>)}</div> : rows.length ? <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground sm:px-4"><span>{l(documentType === "quotation" ? "quotations" : "receipts")}</span><span className="tabular-nums">{rows.length}</span></div>
      <div className="hidden xl:block"><Table className="table-fixed"><TableHeader><TableRow><TableHead className="h-10 w-[22%] text-xs font-medium text-muted-foreground">{l("number")}</TableHead><TableHead className="h-10 text-xs font-medium text-muted-foreground">{l("customer")}</TableHead><TableHead className="h-10 w-32 text-xs font-medium text-muted-foreground">{l("issuedOn")}</TableHead><TableHead className="h-10 w-36 text-xs font-medium text-muted-foreground">{l("status")}</TableHead><TableHead className="h-10 w-40 text-right text-xs font-medium text-muted-foreground">{l("total")}</TableHead><TableHead className="h-10 w-16"><span className="sr-only">{l("documentActions")}</span></TableHead></TableRow></TableHeader><TableBody>{rows.map((document) => <TableRow key={document.document_uuid}>
        <TableCell className="py-2 whitespace-normal">{documentLink(document)}<p className="text-xs text-muted-foreground">{l("version")} {document.version}</p></TableCell>
        <TableCell className="py-2 whitespace-normal"><p className="truncate font-medium" title={document.customer.name}>{document.customer.name}</p>{source(document)}</TableCell>
        <TableCell className="py-2 text-xs tabular-nums"><time dateTime={document.issued_on}>{document.issued_on}</time></TableCell>
        <TableCell className="py-2">{status(document)}</TableCell><TableCell className="py-2 text-right font-semibold tabular-nums">{formatCommercialMoney(document.total, document.currency)} <span className="text-xs font-normal text-muted-foreground">{l(commercialCurrencyLabelKey(document.currency))}</span></TableCell><TableCell className="py-2 text-right">{actions(document)}</TableCell>
      </TableRow>)}</TableBody></Table></div>
      <div className="divide-y divide-border xl:hidden">{rows.map((document) => <article key={document.document_uuid} className="grid min-w-0 gap-1 px-3 py-2" aria-label={document.number}>
        <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0">{documentLink(document)}</div>{actions(document)}</div>
        <div className="flex min-w-0 items-baseline justify-between gap-3"><p className="min-w-0 truncate text-sm font-medium" title={document.customer.name}>{document.customer.name}</p><p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{formatCommercialMoney(document.total, document.currency)} <span className="text-xs font-normal text-muted-foreground">{l(commercialCurrencyLabelKey(document.currency))}</span></p></div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1 text-xs text-muted-foreground"><time dateTime={document.issued_on} className="tabular-nums">{document.issued_on}</time><span>·</span><span>{l("version")} {document.version}</span>{status(document)}</div>
        {source(document)}
      </article>)}</div>
    </div> : !error ? <Empty className="min-h-48 rounded-lg border border-border bg-card"><EmptyHeader><EmptyTitle className="text-base">{l(search ? "noResults" : "emptyDocuments")}</EmptyTitle><EmptyDescription>{l("emptyDocumentsHint")}</EmptyDescription></EmptyHeader><Button asChild className="min-h-11"><Link href={createHref}><Plus />{l(documentType === "quotation" ? "newQuotation" : "newReceipt")}</Link></Button></Empty> : null}
    {conversion ? <QuotationReceiptDialog document={conversion} onClose={() => setConversion(null)} /> : null}
  </section>;
}

interface CommercialHistoryActionsProps {
  document: CommercialDocument;
  l: CommercialLabels;
  disabled: boolean;
  editHref: string;
  onRevisions: () => void;
  onReceipt?: () => void;
}

function CommercialHistoryActions({ document, l, disabled, editHref, onRevisions, onReceipt }: CommercialHistoryActionsProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingAction = useRef<(() => void) | null>(null);

  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button ref={trigger} type="button" variant="ghost" size="icon" className="size-11 shrink-0" disabled={disabled} aria-label={`${l("documentActions")} ${document.number}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56 font-lao" onCloseAutoFocus={(event) => {
      const action = pendingAction.current;
      pendingAction.current = null;
      if (!action) return;
      event.preventDefault();
      const opener = trigger.current;
      if (!opener?.isConnected || opener.disabled || !opener.getClientRects().length) return;
      // Close the menu and focus its real trigger before the dialog captures its opener.
      opener.focus({ preventScroll: true });
      action();
    }}>
      <DropdownMenuLabel className="truncate">{document.number}</DropdownMenuLabel>
      <DropdownMenuItem asChild className="min-h-11 text-sm"><Link href={internalRoute(editHref)}><Pencil />{l("editDocument")}</Link></DropdownMenuItem>
      <DropdownMenuItem className="min-h-11 text-sm" onSelect={() => { pendingAction.current = onRevisions; }}><History />{l("revisionHistory")}</DropdownMenuItem>
      {onReceipt ? <><DropdownMenuSeparator /><DropdownMenuItem className="min-h-11 text-sm" onSelect={() => { pendingAction.current = onReceipt; }}><ReceiptText />{l(document.receipt_uuid ? "viewReceipt" : "createReceipt")}</DropdownMenuItem></> : null}
      {document.document_type === "quotation" && document.receipt_uuid && document.version > 1 ? <><DropdownMenuSeparator /><DropdownMenuLabel className="whitespace-normal text-xs leading-relaxed font-normal">{l("linkedReceiptUnchanged")}</DropdownMenuLabel></> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}

interface QuotationReceiptDialogProps { document: CommercialDocument; onClose: () => void }

function QuotationReceiptDialog({ document, onClose }: QuotationReceiptDialogProps) {
  const [opener] = useState(() => typeof window !== "undefined" && globalThis.document.activeElement instanceof HTMLElement ? globalThis.document.activeElement : null);
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
      const receipt = await convert({ branch_uuid: document.branch_uuid, document_uuid: document.document_uuid, expected_version: document.version, issued_on: issuedOn, payment_method: method, notes });
      if (!receipt) return;
      showToast({ title: l("saved"), description: receipt.number, tone: "success" });
      onClose();
    } catch {
      // Conversion errors stay in the store and leave the payment fields intact.
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent className="font-lao sm:max-w-xl" showCloseButton={!saving} onCloseAutoFocus={(event) => { event.preventDefault(); if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true }); }}><DialogHeader><DialogTitle>{l("createReceipt")} · {document.number}</DialogTitle><DialogDescription>{l("receiptHint")}</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={submit}>{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}<p className="text-base font-semibold">{document.customer.name} · {formatCommercialMoney(document.total, document.currency)} {l(commercialCurrencyLabelKey(document.currency))}</p><Field><FieldLabel htmlFor="commercial-receipt-date">{l("issuedOn")}</FieldLabel><Input id="commercial-receipt-date" type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} required disabled={saving} /></Field><CommercialPaymentField value={method} onChange={setMethod} disabled={saving} l={l} /><Field><FieldLabel htmlFor="commercial-receipt-notes">{l("notes")}</FieldLabel><Textarea id="commercial-receipt-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} disabled={saving} /></Field><DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>{l("close")}</Button><Button type="submit" disabled={saving}>{l(saving ? "saving" : "createReceipt")}</Button></DialogFooter></form></DialogContent></Dialog>;
}
