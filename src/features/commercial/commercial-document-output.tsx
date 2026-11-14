"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { commercialEditHref } from "@/features/commercial/commercial-routes";
import { internalRoute } from "@/lib/routes";
import { useTranslation } from "react-i18next";
import { Download, History, Info, MoreHorizontal, Pencil, Printer, Share2, SlidersHorizontal, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { CommercialShareDialog } from "@/features/commercial/commercial-share-dialog";
import { useCommercialStore } from "@/stores/commercial-store";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { createSessionGuard } from "@/stores/session-store-registry";
import { commercialSessionIdentity } from "@/lib/commercial-permissions";
import type { CatalogItem, CommercialDocument, CommercialParty } from "@/services/commercial";
import { renderCommercialCatalog, renderCommercialDocument, type CommercialPrintOptions } from "./commercial-print";
import { updateCommercialPreview } from "./commercial-page-layout";
import { createCommercialPdfLease, type CommercialPdfLease } from "./commercial-pdf-download";
import { getCommercialPdfAndroidSupport, prepareAndroidCommercialPdf, type PreparedAndroidCommercialPdf } from "./native-commercial-pdf";
import { COMMERCIAL_PAPER } from "./commercial-paper";

interface OutputFrameProps {
  title: string;
  heading?: string;
  subtitle?: string;
  onClose: () => void;
  initialShowImages: boolean;
  paymentVisibility?: { accounts: boolean; qr: boolean };
  render: (options: CommercialPrintOptions) => string;
  toolbar?: ReactNode;
  metadata?: ReactNode;
}

const PREVIEW_WIDTH = Math.ceil(COMMERCIAL_PAPER.widthMm * 96 / 25.4);
const PREVIEW_HEIGHT = Math.ceil(COMMERCIAL_PAPER.heightMm * 96 / 25.4);

function outputIdentity() {
  const { user, token } = useAuthStore.getState();
  return commercialSessionIdentity(user, token);
}

function CommercialOutputFrame(props: OutputFrameProps) {
  const identity = useAuthStore(state => commercialSessionIdentity(state.user, state.token));
  const [session, setSession] = useState({ identity, generation: 0 });
  if (session.identity !== identity) setSession({ identity, generation: session.generation + 1 });
  // Drop prepared private files before a different session can interact with them.
  return <CommercialOutputContent key={`${props.title}:${session.generation}`} {...props} />;
}

function CommercialOutputContent({ title, heading, subtitle, onClose, initialShowImages, paymentVisibility, render, toolbar, metadata }: OutputFrameProps) {
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
  const viewport = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ scale: 1, height: PREVIEW_HEIGHT });
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
  useEffect(() => {
    const target = viewport.current;
    if (!target) return;
    const measure = () => {
      if (!target.clientWidth) return;
      const pages = frame.current?.contentDocument?.querySelector<HTMLElement>("[data-commercial-pages]");
      const height = Math.max(PREVIEW_HEIGHT, Math.ceil(pages?.getBoundingClientRect().height ?? PREVIEW_HEIGHT));
      const scale = Math.min(1, target.clientWidth / PREVIEW_WIDTH);
      setPreviewSize(previous => previous.height === height && previous.scale === scale ? previous : { scale, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    measure();
    return () => observer.disconnect();
  }, [previewKey, previewReady]);
  const preparePreview = () => {
    const target = frame.current?.contentDocument;
    if (!target) return;
    const sessionCurrent = createSessionGuard();
    const current = () => sessionCurrent() && frame.current?.contentDocument === target;
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
    const sessionCurrent = createSessionGuard();
    try {
      const target = frame.current?.contentWindow;
      if (!target || !frame.current?.contentDocument) throw new Error("preview_unavailable");
      await target.document.fonts.ready;
      await Promise.all(Array.from(target.document.images, image => image.decode()));
      if (!sessionCurrent() || !mounted.current || identity !== outputIdentity() || frame.current?.contentWindow !== target) return;
      target.focus();
      target.print();
    } catch {
      if (sessionCurrent() && mounted.current && identity === outputIdentity()) setError(t("commercial.printFailed", { defaultValue: "ພິມບໍ່ສໍາເລັດ. ກະລຸນາດາວໂຫຼດ PDF ແລ້ວພິມຈາກໄຟລ໌." }));
    }
  };

  const prepareShare = async () => {
    if (exportingNow.current || !previewReady) return;
    if (androidSupport === "update-required") return;
    const cachedFile = shareError ? null : shareFile;
    const request = ++shareRequest.current;
    const identity = outputIdentity();
    const sessionCurrent = createSessionGuard();
    const source = frame.current?.contentDocument;
    const current = () => sessionCurrent() && mounted.current && request === shareRequest.current && identity === outputIdentity() && frame.current?.contentDocument === source;
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
    <DialogContent showCloseButton={false} className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-7xl flex-col gap-0 overflow-hidden rounded-lg p-0 font-lao sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-7xl">
      <div className="flex shrink-0 items-center gap-3 border-b bg-card px-3 py-2 sm:px-5 sm:py-3">
        <DialogHeader className="min-w-0 flex-1 gap-0.5 rounded-none border-0 bg-transparent p-0">
          <DialogTitle className="truncate font-lao text-base tabular-nums">{heading ?? title}</DialogTitle>
          <DialogDescription className="truncate text-xs">{subtitle ?? l("catalogOutput")} · A4</DialogDescription>
        </DialogHeader>
        <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-md" aria-label={l("close")} disabled={exporting} onClick={onClose}><X /></Button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-2 py-2 sm:px-4">
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild><Button type="button" variant="ghost" className="min-h-11 min-w-11 px-3" aria-label={l("displayOptions")} disabled={exporting}><SlidersHorizontal /><span className="hidden sm:inline">{l("displayOptions")}</span></Button></PopoverTrigger>
            <PopoverContent align="start" className="max-w-[calc(100vw-2rem)] gap-0 p-3 font-lao text-sm">
              <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">{l("displayOptions")}</p>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-1"><span>{t("commercial.showImages", { defaultValue: "ສະແດງຮູບສິນຄ້າ" })}</span><Checkbox disabled={exporting} checked={showImages} onCheckedChange={value => setShowImages(value === true)} /></label>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-1"><span>{l("showLogo")}</span><Checkbox disabled={exporting} checked={showLogo} onCheckedChange={value => setShowLogo(value === true)} /></label>
              {paymentVisibility?.accounts ? <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-1"><span>{l("showPaymentAccounts")}</span><Checkbox disabled={exporting} checked={showPaymentAccounts} onCheckedChange={value => setShowPaymentAccounts(value === true)} /></label> : null}
              {paymentVisibility?.qr ? <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-1"><span>{l("showPaymentQr")}</span><Checkbox disabled={exporting} checked={showPaymentQr} onCheckedChange={value => setShowPaymentQr(value === true)} /></label> : null}
            </PopoverContent>
          </Popover>
          {metadata ? <Popover><PopoverTrigger asChild><Button type="button" variant="ghost" className="min-h-11 min-w-11 px-3" aria-label={l("documentDetails")}><Info /><span className="hidden lg:inline">{l("documentDetails")}</span></Button></PopoverTrigger><PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] gap-2 p-4 font-lao"><p className="text-sm font-medium">{l("documentDetails")}</p>{metadata}</PopoverContent></Popover> : null}
          {!exporting ? toolbar : null}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {!isCapacitorNativeApp() ? <Button type="button" variant="ghost" className="min-h-11 min-w-11 px-3" aria-label={t("commercial.print", { defaultValue: "ພິມ" })} disabled={exporting || !previewReady} onClick={() => { void print(); }}><Printer /><span className="hidden sm:inline">{t("commercial.print", { defaultValue: "ພິມ" })}</span></Button> : null}
          <Button type="button" variant="outline" className="min-h-11 min-w-11 px-3" aria-label={l("sharePdf")} disabled={exporting || !previewReady} onClick={() => openExport("share")}><Share2 /><span className="hidden sm:inline">{l("sharePdf")}</span></Button>
          <Button type="button" className="min-h-11 px-3 sm:px-4" aria-label={l("downloadPdf")} disabled={exporting || !previewReady} onClick={() => openExport("download")}><Download /><span className="sm:hidden">PDF</span><span className="hidden sm:inline">{t(exporting ? "commercial.saving" : "commercial.downloadPdf", { defaultValue: exporting ? "ກໍາລັງບັນທຶກ…" : "ດາວໂຫຼດ PDF" })}</span></Button>
        </div>
      </div>
      {error ? <Alert variant="destructive" className="m-3 w-auto shrink-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div role="region" tabIndex={0} aria-label={l("previewTab")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/50 p-3 outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5">
        <div ref={viewport} className="w-full min-w-0">
          <div className="relative mx-auto max-w-full overflow-hidden bg-background shadow-sm ring-1 ring-border" style={{ width: PREVIEW_WIDTH * previewSize.scale, height: previewSize.height * previewSize.scale }}>
            <iframe key={previewKey} ref={frame} title={title} srcDoc={html} onLoad={preparePreview} sandbox="allow-same-origin allow-modals" tabIndex={-1} scrolling="no" className="pointer-events-none absolute top-0 left-0 border-0" style={{ width: PREVIEW_WIDTH, height: previewSize.height, transform: `scale(${previewSize.scale})`, transformOrigin: "top left" }} />
          </div>
        </div>
      </div>
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
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  const openRevisionsAfterMenu = useRef(false);
  return <CommercialOutputFrame title={`${document.number} · ${l("version")} ${document.version}`} heading={document.number} subtitle={`${l(document.document_type === "quotation" ? "quotations" : "receipts")} · ${l("version")} ${document.version}${readOnly ? ` · ${l("readOnlyRevision")}` : ""}`} onClose={onClose} initialShowImages={document.show_images}
    paymentVisibility={{ accounts: document.payment_details ? document.payment_details.show_accounts === true : Boolean(document.issuer.bank_details), qr: document.payment_details?.show_qr === true }}
    toolbar={!readOnly ? <DropdownMenu><DropdownMenuTrigger asChild><Button ref={actionsTrigger} type="button" variant="ghost" size="icon" className="size-11" aria-label={l("documentActions")} disabled={loading || saving}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-64 font-lao" onCloseAutoFocus={event => {
      if (!openRevisionsAfterMenu.current) return;
      openRevisionsAfterMenu.current = false;
      const trigger = actionsTrigger.current;
      if (!trigger?.isConnected || trigger.disabled || !trigger.getClientRects().length) return;
      // Let the revision dialog capture the persistent button, not a removed menu item.
      event.preventDefault();
      trigger.focus({ preventScroll: true });
      void openRevisions(document.document_uuid).catch(() => {});
    }}>{!alreadyEditing ? <DropdownMenuItem asChild className="min-h-11 text-sm"><Link href={internalRoute(commercialEditHref({ storeUuid, branchUuid: document.branch_uuid }, document.document_uuid))}><Pencil />{l("editDocument")}</Link></DropdownMenuItem> : null}<DropdownMenuItem className="min-h-11 text-sm" disabled={loading || saving} onSelect={() => { openRevisionsAfterMenu.current = true; }}><History />{l("revisionHistory")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}
    metadata={<div className="grid gap-2 break-words text-xs text-muted-foreground"><p className="text-sm text-foreground">{document.customer.name}</p><p>{l("updatedOn")}: {new Date(document.updated_at || document.created_at).toLocaleString()}</p>{document.source_quotation_version ? <p>{l("sourceQuotationVersion")} {document.source_quotation_number || ""} · {l("version")} {document.source_quotation_version}</p> : null}{document.document_type === "quotation" && document.receipt_uuid && document.version > 1 ? <p>{l("linkedReceiptUnchanged")}</p> : null}</div>}
    render={options => renderCommercialDocument(document, options)} />;
}

export function CommercialCatalogOutput({ items, branchName, issuer, onClose, showImages = true }: { items: CatalogItem[]; branchName: string; issuer?: CommercialParty; onClose: () => void; showImages?: boolean }) {
  return <CommercialOutputFrame title={branchName} onClose={onClose} initialShowImages={showImages} render={options => renderCommercialCatalog(items, branchName, issuer, options)} />;
}
