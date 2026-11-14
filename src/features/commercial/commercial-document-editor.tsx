"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, FileText, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommercialLivePreview } from "@/features/commercial/commercial-live-preview";
import { buildCommercialDraftPreview } from "@/features/commercial/commercial-draft-preview";
import { commercialDocumentLines, commercialLineInput, commercialToday, commercialTotals, formatCommercialMoney, newCommercialLine, PLC_ISSUER, validCommercialDocument, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import { useCommercialLabels, type CommercialLabels } from "@/features/commercial/commercial.locale";
import type { CommercialDiscountType, CommercialDocument, CommercialDocumentType, CommercialParty, CreateCommercialDocumentInput } from "@/services/commercial";
import { useCommercialStore } from "@/stores/commercial-store";
import { useToastStore } from "@/stores/toast-store";
import { createMutationUuid } from "@/lib/pos/mutation-identity";
import { ServiceError } from "@/lib/api";
import { internalRoute } from "@/lib/routes";
import { commercialUpdateAttempt } from "@/features/commercial/commercial-mutation-identity";
import { CommercialWizardStepper } from "@/features/commercial/commercial-wizard-stepper";
import { COMMERCIAL_WIZARD_LAST_STEP, firstInvalidCommercialStep, validateCommercialStep } from "@/features/commercial/commercial-wizard";
import { CommercialPaymentFields } from "@/features/commercial/commercial-payment-fields";
import { commercialPaymentDraft, commercialPaymentInput, commercialPaymentPreview, validCommercialPaymentDraft } from "@/features/commercial/commercial-payment";

interface CommercialDocumentEditorProps { branchUuid: string; documentType: CommercialDocumentType; existing?: CommercialDocument; backHref: string; onSaved: (document: CommercialDocument) => void }

export function CommercialDocumentEditor({ branchUuid, documentType, existing, backHref, onSaved }: CommercialDocumentEditorProps) {
  const l = useCommercialLabels();
  const catalog = useCommercialStore((state) => state.catalog);
  const catalogLoading = useCommercialStore((state) => state.catalogLoading);
  const createDocument = useCommercialStore((state) => state.createDocument);
  const updateDocument = useCommercialStore((state) => state.updateDocument);
  const openDocument = useCommercialStore((state) => state.openDocument);
  const beginEdit = useCommercialStore((state) => state.beginEdit);
  const documentLoading = useCommercialStore((state) => state.loading);
  const editConflict = useCommercialStore((state) => state.editConflict);
  const saving = useCommercialStore((state) => state.saving);
  const error = useCommercialStore((state) => state.error);
  const showToast = useToastStore((state) => state.show);
  const [customer, setCustomer] = useState<CommercialParty>(() => existing ? { ...existing.customer } : { name: "" });
  const [issuer, setIssuer] = useState<CommercialParty>(() => ({ ...(existing?.issuer ?? PLC_ISSUER) }));
  const [issuedOn, setIssuedOn] = useState(() => existing?.issued_on ?? commercialToday());
  const [validUntil, setValidUntil] = useState(existing?.valid_until ?? "");
  const [paymentMethod, setPaymentMethod] = useState(existing?.payment_method || "cash");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [showImages, setShowImages] = useState(existing?.show_images ?? true);
  const [payment, setPayment] = useState(() => commercialPaymentDraft(existing?.payment_details, existing?.issuer.bank_details));
  const [taxRate, setTaxRate] = useState<0 | 10>(existing?.tax_rate ?? 0);
  const [discountType, setDiscountType] = useState<CommercialDiscountType>(existing?.discount_type ?? "amount");
  const [discountValue, setDiscountValue] = useState(existing?.discount_value ? String(existing.discount_value) : "");
  const [reloadOpen, setReloadOpen] = useState(false);
  const [lines, setLines] = useState<CommercialDraftLine[]>(() => existing ? commercialDocumentLines(existing) : []);
  const [removeLine, setRemoveLine] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [requestUuid] = useState(createMutationUuid);
  const updateAttempt = useRef({ requestUuid, payload: null as string | null });
  const createUuid = useRef(requestUuid);
  const createAttempt = useRef<CreateCommercialDocumentInput | null>(null);
  const [createRecovery, setCreateRecovery] = useState(false);
  const [pane, setPane] = useState("details");
  const [currentStep, setCurrentStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(existing ? COMMERCIAL_WIZARD_LAST_STEP : 0);
  const form = useRef<HTMLFormElement>(null);
  const details = useRef<HTMLDivElement>(null);
  const savePaint = useRef(0);
  const steps = [l("wizardDocument"), l("customer"), l("issuer"), l("wizardItems"), l("wizardReview")];
  const draft = buildCommercialDraftPreview({ branchUuid, documentType, issuedOn, validUntil, customer, issuer, notes, paymentMethod, showImages, paymentDetails: commercialPaymentPreview(payment), taxRate, discountType, discountValue, lines, draftLabel: existing?.number ?? l("draft"), version: existing?.version, sourceQuotationUuid: existing?.source_quotation_uuid, sourceQuotationVersion: existing?.source_quotation_version, sourceQuotationNumber: existing?.source_quotation_number });

  useEffect(() => () => cancelAnimationFrame(savePaint.current), []);

  function requestSave() {
    if (saving) return;
    form.current?.requestSubmit();
  }
  const totals = commercialTotals(lines, taxRate, { discountType, discountValue });
  const activeCatalog = catalog.filter((item) => item.active);

  function changeLine(key: string, patch: Partial<CommercialDraftLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function documentInput(): CreateCommercialDocumentInput {
    return !existing && createRecovery && createAttempt.current ? createAttempt.current : {
      request_uuid: existing ? requestUuid : createUuid.current, branch_uuid: branchUuid, document_type: documentType, issued_on: issuedOn,
      ...(documentType === "quotation" ? { valid_until: validUntil || null } : { payment_method: paymentMethod }),
      customer, issuer, notes, show_images: showImages, tax_rate: taxRate, discount_type: Number(discountValue) > 0 ? discountType : null, discount_value: Number(discountValue || 0), items: lines.map(commercialLineInput),
      payment_details: commercialPaymentInput(payment),
    };
  }

  function stepFields(step: number) {
    return Array.from(form.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-commercial-step="${step}"] input, [data-commercial-step="${step}"] textarea, [data-commercial-step="${step}"] select`) ?? [])
      .filter((control) => control.type !== "hidden" && control.getAttribute("aria-hidden") !== "true");
  }

  function revealStep(step: number, invalid = false) {
    setCurrentStep(step);
    setPane("details");
    cancelAnimationFrame(savePaint.current);
    savePaint.current = requestAnimationFrame(() => {
      details.current?.scrollTo({ top: 0 });
      if (!invalid) return;
      const fields = stepFields(step);
      const paymentControl = step === 4 && !validCommercialPaymentDraft(payment, issuer.bank_details)
        ? Array.from(form.current?.querySelectorAll<HTMLElement>("[data-payment-focus]") ?? []).find((control) => !control.matches(":disabled")) : undefined;
      const field = paymentControl ? undefined : fields.find((control) => !control.checkValidity()) ?? fields.find((control) => !control.matches(":disabled"));
      const fallback = paymentControl ?? form.current?.querySelector<HTMLElement>(`[data-commercial-step="${step}"] [data-step-focus]`);
      (field ?? fallback)?.focus({ preventScroll: true });
      (field ?? fallback)?.scrollIntoView({ block: "center" });
      field?.reportValidity();
    });
  }

  function stepValid(step: number, input: CreateCommercialDocumentInput) {
    return validateCommercialStep(step, input, lines) && (step !== 4 || validCommercialPaymentDraft(payment, issuer.bank_details)) && stepFields(step).every((control) => control.checkValidity());
  }

  function showStepError(step: number) {
    setValidation(`${l("wizardStepRequired")} · ${step + 1}. ${steps[step]}`);
    revealStep(step, true);
  }

  function goToStep(step: number) {
    if (saving || step < 0 || step > COMMERCIAL_WIZARD_LAST_STEP || step > furthestStep + 1) return;
    if (step > currentStep) {
      const input = documentInput();
      for (let index = currentStep; index < step; index += 1) {
        if (!stepValid(index, input)) { showStepError(index); return; }
      }
    }
    setValidation(null);
    setFurthestStep((current) => Math.max(current, step));
    revealStep(step);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (currentStep < COMMERCIAL_WIZARD_LAST_STEP) { goToStep(currentStep + 1); return; }
    const input = documentInput();
    const invalidDataStep = firstInvalidCommercialStep(input, lines) ?? (validCommercialPaymentDraft(payment, issuer.bank_details) ? null : 4);
    const invalidStep = steps.findIndex((_, step) => step === invalidDataStep || !stepFields(step).every((control) => control.checkValidity()));
    if (invalidStep >= 0) { showStepError(invalidStep); return; }
    if (!validCommercialDocument(input)) { setValidation(l("documentRequired")); revealStep(COMMERCIAL_WIZARD_LAST_STEP, true); return; }
    setValidation(null);
    try {
      if (existing) updateAttempt.current = commercialUpdateAttempt(updateAttempt.current, input, createMutationUuid);
      else createAttempt.current = input;
      const document = existing ? await updateDocument({ ...input, document_uuid: existing.document_uuid, expected_version: existing.version, request_uuid: updateAttempt.current.requestUuid }) : await createDocument(input);
      if (!document) return;
      showToast({ title: l("saved"), description: document.number, tone: "success" });
      onSaved(document);
    } catch (failure) {
      if (!existing) {
        const definitive = failure instanceof ServiceError && failure.statusCode >= 400 && failure.statusCode < 500 && ![408, 409, 425, 429].includes(failure.statusCode);
        if (definitive) { createAttempt.current = null; createUuid.current = createMutationUuid(); }
        setCreateRecovery(!definitive);
      }
      // Update conflicts keep all edits. Ambiguous creates recover the exact
      // attempted document before the user makes further changes to it.
    }
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background font-lao">
        <header className="shrink-0 border-b bg-card px-3 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h1 className="font-heading text-lg font-semibold">{existing ? `${l("editDocument")} · ${existing.number}` : l(documentType === "quotation" ? "newQuotation" : "newReceipt")}</h1><p className="mt-1 text-xs text-muted-foreground">{existing ? `${l("editDocumentHint")} · ${l("version")} ${existing.version}` : l("editorHint")}</p></div><Button asChild variant="outline" size="icon" className="size-11 shrink-0"><Link href={internalRoute(backHref)} aria-label={l("backToDocuments")} aria-disabled={saving} onClick={(event) => { if (saving) event.preventDefault(); }}><ArrowLeft /></Link></Button></div>
        </header>
        <CommercialWizardStepper steps={steps} currentStep={currentStep} furthestStep={furthestStep} onStepChange={goToStep} disabled={saving} label={l("wizardProgress")} />
        {validation || error ? <div className="shrink-0 px-3 pt-3 sm:px-5"><Alert variant="destructive"><AlertDescription>{validation || error}</AlertDescription></Alert></div> : null}
        {createRecovery ? <div className="shrink-0 px-3 pt-3 sm:px-5"><Alert><AlertDescription>{l("createRecoveryHint")}</AlertDescription></Alert></div> : null}
        {existing && editConflict ? <div className="shrink-0 px-3 pt-3 sm:px-5"><Alert variant="destructive"><AlertDescription><p>{l("versionConflict")}</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={saving || documentLoading} onClick={() => { void openDocument(existing.document_uuid).catch(() => {}); }}>{l("viewLatest")}</Button><Button type="button" variant="outline" className="min-h-11" disabled={saving || documentLoading} onClick={() => setReloadOpen(true)}>{l("reloadLatest")}</Button></div></AlertDescription></Alert></div> : null}
        {existing?.document_type === "quotation" && existing.receipt_uuid ? <p className="shrink-0 border-b px-3 py-2 text-xs text-muted-foreground sm:px-5">{l("linkedReceiptUnchanged")}</p> : null}
        <Tabs value={pane} onValueChange={setPane} className="min-h-0 flex-1 gap-0 overflow-hidden">
          <TabsList className="mx-3 my-2 grid min-h-12 w-auto shrink-0 grid-cols-2 lg:hidden"><TabsTrigger className="min-h-11 gap-2" value="details"><FileText />{l("detailsTab")}</TabsTrigger><TabsTrigger className="min-h-11 gap-2" value="preview"><Eye />{l("previewTab")}</TabsTrigger></TabsList>
          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,0.48fr)_minmax(0,0.52fr)]">
            <TabsContent ref={details} value="details" forceMount className="m-0 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-3 py-4 data-[state=inactive]:hidden sm:px-5 lg:border-r lg:data-[state=inactive]:block">
              <form ref={form} id="commercial-document-draft" noValidate className="grid min-w-0 gap-5 [&_input]:min-h-11 [&_textarea]:min-h-24" onSubmit={submit} onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement) || currentStep === COMMERCIAL_WIZARD_LAST_STEP) return;
                event.preventDefault();
                goToStep(currentStep + 1);
              }}>
          <h2 className="font-heading font-semibold">{currentStep + 1}. {steps[currentStep]} <span className="text-xs font-normal text-muted-foreground">({currentStep + 1}/5)</span></h2>
          <fieldset disabled={saving || createRecovery} className="contents">
          <fieldset data-commercial-step="0" hidden={currentStep !== 0} aria-label={steps[0]} className={currentStep === 0 ? "grid min-w-0 gap-4" : "hidden"}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="commercial-issued-on">{l("issuedOn")} *</FieldLabel><Input id="commercial-issued-on" type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} required min="2000-01-01" max="2199-12-31" disabled={saving} /></Field>
            {documentType === "quotation" ? <Field><FieldLabel htmlFor="commercial-valid-until">{l("validUntil")}</FieldLabel><Input id="commercial-valid-until" type="date" value={validUntil} min={issuedOn} max="2199-12-31" onChange={(event) => setValidUntil(event.target.value)} disabled={saving} /></Field> : <CommercialPaymentField value={paymentMethod} onChange={setPaymentMethod} disabled={saving} l={l} />}
          </div>
          </fieldset>
          <fieldset data-commercial-step="1" hidden={currentStep !== 1} aria-label={steps[1]} className={currentStep === 1 ? "grid min-w-0 gap-5" : "hidden"}>
            <PartyFields id="commercial-customer" title={l("customer")} value={customer} onChange={setCustomer} disabled={saving} l={l} />
          </fieldset>
          <fieldset data-commercial-step="2" hidden={currentStep !== 2} aria-label={steps[2]} className={currentStep === 2 ? "grid min-w-0 gap-5" : "hidden"}>
            <PartyFields id="commercial-issuer" title={l("issuer")} value={issuer} onChange={setIssuer} disabled={saving} l={l} issuer />
          </fieldset>
          <fieldset data-commercial-step="3" hidden={currentStep !== 3} aria-label={steps[3]} className={currentStep === 3 ? "grid min-w-0 gap-5" : "hidden"}>
          <section className="grid min-w-0 gap-3" aria-label={l("items")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold">{l("items")} ({lines.length})</h2><label className="flex min-h-11 cursor-pointer items-center gap-3"><Switch checked={showImages} onCheckedChange={setShowImages} disabled={saving} /><span>{l("showImages")}</span></label></div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Select value="" disabled={saving || catalogLoading || !activeCatalog.length || lines.length >= 100} onValueChange={(value) => { const item = activeCatalog.find((row) => row.item_uuid === value); if (item) setLines((current) => [...current, newCommercialLine(item)]); }}>
                <SelectTrigger className="h-11 w-full min-w-0 sm:flex-1" aria-label={l("chooseItem")}><SelectValue placeholder={l("chooseItem")} /></SelectTrigger><SelectContent>{activeCatalog.map((item) => <SelectItem key={item.item_uuid} value={item.item_uuid} className="min-h-11"><span className="max-w-64 truncate">{item.name} · {formatCommercialMoney(item.unit_price)}</span></SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" data-step-focus variant="outline" className="min-h-11" disabled={saving || lines.length >= 100} onClick={() => setLines((current) => [...current, newCommercialLine()])}><Plus />{l("customLine")}</Button>
            </div>
            {!lines.length ? <p className="rounded-md border border-dashed p-5 text-center text-muted-foreground">{l("chooseItem")}</p> : null}
            {lines.map((line, index) => <div key={line.key} className="grid min-w-0 gap-3 rounded-lg border bg-card p-3 sm:p-4">
              <div className="flex min-w-0 items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">{index + 1}</span><Field className="min-w-0 flex-1"><FieldLabel htmlFor={`${line.key}-name`}>{l("name")} *</FieldLabel><Input id={`${line.key}-name`} value={line.name} maxLength={250} required disabled={saving} onChange={(event) => changeLine(line.key, { name: event.target.value })} /></Field><Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`${l("removeLine")} ${index + 1}`} disabled={saving} onClick={() => setRemoveLine(line.key)}><Trash2 /></Button></div>
              <Field><FieldLabel htmlFor={`${line.key}-description`}>{l("description")}</FieldLabel><Textarea id={`${line.key}-description`} value={line.description} maxLength={3000} disabled={saving} onChange={(event) => changeLine(line.key, { description: event.target.value })} /></Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Field><FieldLabel htmlFor={`${line.key}-quantity`}>{l("quantity")} *</FieldLabel><Input id={`${line.key}-quantity`} type="number" inputMode="decimal" min="0.001" max="999999.999" step="0.001" value={line.quantity} required disabled={saving} onChange={(event) => changeLine(line.key, { quantity: event.target.value })} /></Field><Field><FieldLabel htmlFor={`${line.key}-unit`}>{l("unit")}</FieldLabel><Input id={`${line.key}-unit`} value={line.unit} maxLength={60} disabled={saving} onChange={(event) => changeLine(line.key, { unit: event.target.value })} /></Field><Field><FieldLabel htmlFor={`${line.key}-price`}>{l("price")} *</FieldLabel><Input id={`${line.key}-price`} type="number" inputMode="numeric" min="0" step="1" value={line.unit_price} required disabled={saving} onChange={(event) => changeLine(line.key, { unit_price: event.target.value })} /></Field></div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{line.image_url ? <label className="flex min-h-11 cursor-pointer items-center gap-3"><Switch checked={line.show_image} onCheckedChange={(checked) => changeLine(line.key, { show_image: checked })} disabled={saving} /><span className="text-xs">{l("showItemImage")}</span></label> : <span />}<p className="text-right font-semibold tabular-nums">{formatCommercialMoney(commercialTotals([line], 0).subtotal)} {l("lak")}</p></div>
            </div>)}
          </section>
          </fieldset>
          <fieldset data-commercial-step="4" hidden={currentStep !== 4} aria-label={steps[4]} className={currentStep === 4 ? "grid min-w-0 gap-5" : "hidden"}>
          <p className="text-sm text-muted-foreground">{l("wizardReviewHint")}</p>
          <CommercialPaymentFields value={payment} onChange={setPayment} active={currentStep === 4} disabled={saving || createRecovery} legacyBankDetails={issuer.bank_details} />
          <div className="grid grid-cols-1 gap-5"><Field><FieldLabel htmlFor="commercial-notes">{l("notes")}</FieldLabel><Textarea id="commercial-notes" className="min-h-28" value={notes} maxLength={5000} disabled={saving} onChange={(event) => setNotes(event.target.value)} /></Field><div className="grid content-start gap-3 rounded-lg border bg-muted/40 p-4"><div className="flex justify-between gap-3"><span>{l("subtotal")}</span><span className="tabular-nums">{formatCommercialMoney(totals.subtotal)}</span></div><Field><FieldLabel htmlFor="commercial-discount">{l("discountOptional")}</FieldLabel><div className="flex min-w-0 gap-2"><Input id="commercial-discount" type="number" inputMode={discountType === "amount" ? "numeric" : "decimal"} min="0" max={discountType === "percent" ? 100 : totals.subtotal} step={discountType === "percent" ? "0.01" : "1"} placeholder="0" value={discountValue} disabled={saving} onChange={(event) => setDiscountValue(event.target.value)} /><Select value={discountType} onValueChange={(value) => setDiscountType(value === "percent" ? "percent" : "amount")} disabled={saving}><SelectTrigger className="h-11 shrink-0" aria-label={l("discountType")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="amount">{l("lak")}</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent></Select></div><p className="text-xs text-muted-foreground">{l("discountHint")}</p></Field>{Number(discountValue) > 0 ? <div className="flex justify-between gap-3"><span>{l("discount")}{discountType === "percent" ? ` (${discountValue}%)` : ""}</span><span className="tabular-nums">−{formatCommercialMoney(totals.discountAmount)}</span></div> : null}<Field orientation="horizontal" className="justify-between"><FieldLabel htmlFor="commercial-tax">{l("tax")}</FieldLabel><Select value={String(taxRate)} onValueChange={(value) => setTaxRate(value === "10" ? 10 : 0)} disabled={saving}><SelectTrigger id="commercial-tax" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">{l("noTax")}</SelectItem><SelectItem value="10">10%</SelectItem></SelectContent></Select></Field><div className="flex justify-between gap-3 text-muted-foreground"><span>{l("tax")}</span><span className="tabular-nums">{formatCommercialMoney(totals.taxAmount)}</span></div><div className="flex justify-between gap-3 border-t pt-3 text-base font-semibold"><span>{l("total")}</span><span className="tabular-nums">{formatCommercialMoney(totals.total)} {l("lak")}</span></div></div></div>
          </fieldset>
          </fieldset>
              </form>
            </TabsContent>
            <TabsContent value="preview" forceMount className="m-0 flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/40 data-[state=inactive]:hidden lg:data-[state=inactive]:flex"><CommercialLivePreview document={draft} statusLabel={existing ? l("unsavedChanges") : undefined} /></TabsContent>
          </div>
        </Tabs>
        <footer className="flex shrink-0 flex-row items-center gap-3 border-t bg-card px-3 py-3 pb-[calc(0.75rem+max(var(--app-shell-bottom-nav-height,0px),var(--pos-system-bottom-safe-area,0px)))] sm:px-5">
          <p className="mr-auto hidden text-sm sm:block">{l("total")}: <strong className="tabular-nums">{formatCommercialMoney(totals.total)} {l("lak")}</strong></p>
          {currentStep > 0 ? <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => goToStep(currentStep - 1)}>{l("wizardPrevious")}</Button> : <Button asChild variant="outline" className="min-h-11"><Link href={internalRoute(backHref)} aria-disabled={saving} onClick={(event) => { if (saving) event.preventDefault(); }}>{l("back")}</Link></Button>}
          {currentStep < COMMERCIAL_WIZARD_LAST_STEP ? <Button type="button" className="min-h-11 flex-1 whitespace-normal sm:flex-none" disabled={saving || documentLoading} onClick={() => goToStep(currentStep + 1)}>{l("wizardNext")}</Button> : <Button type="button" className="min-h-11 flex-1 whitespace-normal sm:flex-none" disabled={saving || documentLoading} onClick={requestSave}>{l(saving ? "saving" : existing ? "saveChanges" : createRecovery ? "recoverDocument" : "saveDocument")}</Button>}
        </footer>
        <AlertDialog open={reloadOpen} onOpenChange={setReloadOpen}><AlertDialogContent className="font-lao"><AlertDialogHeader><AlertDialogTitle>{l("reloadLatest")}</AlertDialogTitle><AlertDialogDescription>{l("reloadLatestConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{l("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (existing) void beginEdit(existing.document_uuid).catch(() => {}); }}>{l("reloadLatest")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        <AlertDialog open={Boolean(removeLine)} onOpenChange={(open) => { if (!open) setRemoveLine(null); }}><AlertDialogContent className="font-lao"><AlertDialogHeader><AlertDialogTitle>{l("removeLine")}</AlertDialogTitle><AlertDialogDescription>{l("removeLineConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{l("cancel")}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setLines((current) => current.filter((line) => line.key !== removeLine)); setRemoveLine(null); }}>{l("remove")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
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
