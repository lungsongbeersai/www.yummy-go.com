"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { commercialEditHref } from "@/features/commercial/commercial-routes";
import { internalRoute } from "@/lib/routes";
import { useTranslation } from "react-i18next";
import { Download, Printer, Share2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { CommercialShareDialog } from "@/features/commercial/commercial-share-dialog";
import { useCommercialStore } from "@/stores/commercial-store";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import type { CatalogItem, CommercialDocument, CommercialParty } from "@/services/commercial";
import { renderCommercialCatalog, renderCommercialDocument, type CommercialPrintOptions } from "./commercial-print";
import { updateCommercialPreview } from "./commercial-page-layout";
import { createCommercialPdfLease, type CommercialPdfLease } from "./commercial-pdf-download";
import { getCommercialPdfAndroidSupport, prepareAndroidCommercialPdf, type PreparedAndroidCommercialPdf } from "./native-commercial-pdf";

interface OutputFrameProps {
  title: string;
  onClose: () => void;
  initialShowImages: boolean;
  paymentVisibility?: { accounts: boolean; qr: boolean };
  render: (options: CommercialPrintOptions) => string;
  toolbar?: ReactNode;
  metadata?: ReactNode;
}

function outputIdentity() {
  const { user, token } = useAuthStore.getState();
  return JSON.stringify([user?.uuid, authStoreUuid(user), token]);
}

function CommercialOutputFrame(props: OutputFrameProps) {
  const identity = useAuthStore(state => JSON.stringify([state.user?.uuid, authStoreUuid(state.user), state.token]));
  const [session, setSession] = useState({ identity, generation: 0 });
  if (session.identity !== identity) setSession({ identity, generation: session.generation + 1 });
  // Drop prepared private files before a different session can interact with them.
  return <CommercialOutputContent key={`${props.title}:${session.generation}`} {...props} />;
}

function CommercialOutputContent({ title, onClose, initialShowImages, paymentVisibility, render, toolbar, metadata }: OutputFrameProps) {
  const { t } = useTranslation();
  const l = useCommercialLabels();
  const laoFont = useAppStore(state => state.laoFont);
  const [showImages, setShowImages] = useState(initialShowImages);
  const [showLogo, setShowLogo] = useState(true);
  const [showPaymentAccounts, setShowPaymentAccounts] = useState(true);
  const [showPaymentQr, setShowPaymentQr] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loadedPreview, setLoadedPreview] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [shareLease, setShareLease] = useState<CommercialPdfLease | null>(null);
  const [nativePdf, setNativePdf] = useState<PreparedAndroidCommercialPdf | null>(null);
  const androidSupport = getCommercialPdfAndroidSupport();
  const [shareMode, setShareMode] = useState<"share" | "download">("share");
  const [sharePreparing, setSharePreparing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const mounted = useRef(false);
  const exportingNow = useRef(false);
  const shareRequest = useRef(0);
  const preparedLease = useRef<CommercialPdfLease | null>(null);
  const preparedNative = useRef<PreparedAndroidCommercialPdf | null>(null);
  const options: CommercialPrintOptions = { showImages, showLogo, showPaymentAccounts, showPaymentQr, laoFont, baseUrl: typeof window === "undefined" ? undefined : window.location.origin };
  const html = render(options);
  const [preview, setPreview] = useState({ html, generation: 0 });
  if (preview.html !== html) {
    setPreview({ html, generation: preview.generation + 1 });
    setLoadedPreview(null);
    setShareOpen(false);
    setShareFile(null);
    setShareLease(null);
    setNativePdf(null);
    setShareError(null);
    setSharePreparing(false);
  }
  const previewKey = `${title}:${preview.generation}`;
  const previewReady = loadedPreview === previewKey;
  useLayoutEffect(() => {
    shareRequest.current += 1;
    return () => {
      preparedLease.current?.release();
      preparedLease.current = null;
      preparedNative.current?.release();
      preparedNative.current = null;
    };
  }, [previewKey]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; shareRequest.current += 1; };
  }, []);
  const preparePreview = () => {
    const target = frame.current?.contentDocument;
    if (!target) return;
    const current = () => frame.current?.contentDocument === target;
    setError(null);
    setLoadedPreview(null);
    void updateCommercialPreview(target, current).then(result => {
      if (result && current()) setLoadedPreview(previewKey);
    }).catch((failure: unknown) => {
      if (current()) setError(`${t("commercial.pdfFailed")} (${failure instanceof Error ? failure.message : "preview_unavailable"})`);
    });
  };
  const print = async () => {
    if (exportingNow.current || !previewReady) return;
    setError(null);
    const identity = outputIdentity();
    try {
      const target = frame.current?.contentWindow;
      if (!target || !frame.current?.contentDocument) throw new Error("preview_unavailable");
      await target.document.fonts.ready;
      await Promise.all(Array.from(target.document.images, image => image.decode()));
      if (!mounted.current || identity !== outputIdentity() || frame.current?.contentWindow !== target) return;
      target.focus();
      target.print();
    } catch {
      setError(t("commercial.printFailed", { defaultValue: "ພິມບໍ່ສໍາເລັດ. ກະລຸນາດາວໂຫຼດ PDF ແລ້ວພິມຈາກໄຟລ໌." }));
    }
  };

  const prepareShare = async () => {
    if (exportingNow.current || !previewReady) return;
    if (androidSupport === "update-required") return;
    const cachedFile = shareError ? null : shareFile;
    const request = ++shareRequest.current;
    const identity = outputIdentity();
    const source = frame.current?.contentDocument;
    const current = () => mounted.current && request === shareRequest.current && identity === outputIdentity() && frame.current?.contentDocument === source;
    preparedLease.current?.release();
    preparedLease.current = null;
    preparedNative.current?.release();
    preparedNative.current = null;
    setNativePdf(null);
    setShareFile(null);
    setShareLease(null);
    setShareError(null);
    setSharePreparing(true);
    setExporting(true);
    exportingNow.current = true;
    try {
      if (!source) throw new Error("preview_unavailable");
      let file = cachedFile;
      if (!file) {
        const { createCommercialPdf } = await import("@/features/commercial/commercial-pdf");
        if (!current()) return;
        file = (await createCommercialPdf(source, title, current)).file;
      }
      if (!current()) return;
      if (androidSupport === "supported") {
        const native = await prepareAndroidCommercialPdf(file, current);
        if (!current()) { native.release(); return; }
        preparedNative.current = native;
        setNativePdf(native);
      } else {
        const lease = createCommercialPdfLease(file, {
          isCurrent: current,
          watchIdentity: invalidate => useAuthStore.subscribe(() => { if (identity !== outputIdentity()) invalidate(); }),
        });
        preparedLease.current = lease;
        setShareLease(lease);
      }
      setShareFile(file);
    } catch (failure) {
      if (current()) setShareError(`${t("commercial.pdfFailed")} (${failure instanceof Error ? failure.message : "pdf_unavailable"})`);
    } finally {
      exportingNow.current = false;
      if (mounted.current) setExporting(false);
      if (current()) setSharePreparing(false);
    }
  };

  const openExport = (mode: "share" | "download") => {
    if (exportingNow.current || !previewReady) return;
    setError(null);
    setShareMode(mode);
    setShareOpen(true);
    if (androidSupport !== "update-required" && (!shareFile || (androidSupport === "supported" ? !nativePdf : !shareLease?.isAvailable()))) void prepareShare();
  };

  const closeShare = () => {
    shareRequest.current += 1;
    preparedLease.current?.release();
    preparedLease.current = null;
    preparedNative.current?.release();
    preparedNative.current = null;
    setNativePdf(null);
    setShareOpen(false);
    setShareFile(null);
    setShareLease(null);
    setShareError(null);
    setSharePreparing(false);
  };
  return <Dialog open onOpenChange={open => { if (!open && !exporting) onClose(); }}>
    <DialogContent showCloseButton={!exporting} className="w-[calc(100%-1rem)] max-w-6xl gap-3 p-3 sm:max-w-6xl sm:p-5">
      <DialogHeader>
        <DialogTitle className="font-lao">{title}</DialogTitle>
        <DialogDescription className="font-lao">{t("commercial.documentOutputHint", { defaultValue: "ເອກະສານ A4 · ເລືອກສະແດງຮູບ ແລ້ວພິມ ຫຼື ດາວໂຫຼດ PDF." })}</DialogDescription>
      </DialogHeader>
      {metadata}
      <div className="flex flex-wrap items-center gap-4 font-lao">
        <label className="flex min-h-11 cursor-pointer items-center gap-2"><Checkbox disabled={exporting} checked={showImages} onCheckedChange={value => setShowImages(value === true)} />{t("commercial.showImages", { defaultValue: "ສະແດງຮູບສິນຄ້າ" })}</label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2"><Checkbox disabled={exporting} checked={showLogo} onCheckedChange={value => setShowLogo(value === true)} />{t("commercial.showLogo", { defaultValue: "ສະແດງໂລໂກ້" })}</label>
        {paymentVisibility?.accounts ? <label className="flex min-h-11 cursor-pointer items-center gap-2"><Checkbox disabled={exporting} checked={showPaymentAccounts} onCheckedChange={value => setShowPaymentAccounts(value === true)} />{l("showPaymentAccounts")}</label> : null}
        {paymentVisibility?.qr ? <label className="flex min-h-11 cursor-pointer items-center gap-2"><Checkbox disabled={exporting} checked={showPaymentQr} onCheckedChange={value => setShowPaymentQr(value === true)} />{l("showPaymentQr")}</label> : null}
        <div className="flex flex-wrap gap-2 sm:ml-auto">{!exporting ? toolbar : null}{!isCapacitorNativeApp() ? <Button type="button" variant="outline" className="min-h-11" disabled={exporting || !previewReady} onClick={() => { void print(); }}><Printer />{t("commercial.print", { defaultValue: "ພິມ" })}</Button> : null}
        <Button type="button" variant="outline" className="min-h-11" disabled={exporting || !previewReady} onClick={() => openExport("share")}><Share2 />{l("sharePdf")}</Button>
        <Button type="button" className="min-h-11" disabled={exporting || !previewReady} onClick={() => openExport("download")}><Download />{t(exporting ? "commercial.saving" : "commercial.downloadPdf", { defaultValue: exporting ? "ກໍາລັງບັນທຶກ…" : "ດາວໂຫຼດ PDF" })}</Button></div>
      </div>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <iframe key={previewKey} ref={frame} title={title} srcDoc={html} onLoad={preparePreview} sandbox="allow-same-origin allow-modals" className="h-[62dvh] w-full rounded-md border border-border bg-background" />
    </DialogContent>
    {shareOpen ? <CommercialShareDialog title={title} mode={shareMode} file={shareFile} lease={shareLease} nativePdf={nativePdf} preparing={sharePreparing} error={shareError} onPrepare={() => { void prepareShare(); }} onClose={closeShare} /> : null}
  </Dialog>;
}

export function CommercialDocumentOutput({ document, onClose, readOnly = false }: { document: CommercialDocument; onClose: () => void; readOnly?: boolean }) {
  const l = useCommercialLabels();
  const storeUuid = useCommercialStore((state) => state.storeUuid);
  const pathname = usePathname();
  const alreadyEditing = pathname.endsWith("/edit");
  const openRevisions = useCommercialStore((state) => state.openRevisions);
  const loading = useCommercialStore((state) => state.loading);
  const saving = useCommercialStore((state) => state.saving);
  return <CommercialOutputFrame title={`${document.number} · ${l("version")} ${document.version}`} onClose={onClose} initialShowImages={document.show_images}
    paymentVisibility={{ accounts: document.payment_details ? document.payment_details.show_accounts === true : Boolean(document.issuer.bank_details), qr: document.payment_details?.show_qr === true }}
    toolbar={!readOnly ? <>{!alreadyEditing ? <Button asChild variant="outline" className="min-h-11"><Link href={internalRoute(commercialEditHref({ storeUuid, branchUuid: document.branch_uuid }, document.document_uuid))}>{l("editDocument")}</Link></Button> : null}<Button variant="outline" className="min-h-11" disabled={loading || saving} onClick={() => { void openRevisions(document.document_uuid).catch(() => {}); }}>{l("revisionHistory")}</Button></> : null}
    metadata={<div className="grid gap-1 font-lao text-xs text-muted-foreground"><p>{l("version")} {document.version} · {l("updatedOn")}: {new Date(document.updated_at || document.created_at).toLocaleString()}{readOnly ? ` · ${l("readOnlyRevision")}` : ""}</p>{document.source_quotation_version ? <p>{l("sourceQuotationVersion")} {document.source_quotation_number || ""} · {l("version")} {document.source_quotation_version}</p> : null}{document.document_type === "quotation" && document.receipt_uuid && document.version > 1 ? <p>{l("linkedReceiptUnchanged")}</p> : null}</div>}
    render={options => renderCommercialDocument(document, options)} />;
}

export function CommercialCatalogOutput({ items, branchName, issuer, onClose, showImages = true }: { items: CatalogItem[]; branchName: string; issuer?: CommercialParty; onClose: () => void; showImages?: boolean }) {
  return <CommercialOutputFrame title={branchName} onClose={onClose} initialShowImages={showImages} render={options => renderCommercialCatalog(items, branchName, issuer, options)} />;
}
