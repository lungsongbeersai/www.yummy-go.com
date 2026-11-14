"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { Download, ExternalLink, FileText, LoaderCircle, Share2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { canShareCommercialPdf, isCommercialPdfFile, isCommercialShareCancelled, shareCommercialPdf } from "@/features/commercial/commercial-share";
import type { CommercialPdfLease } from "@/features/commercial/commercial-pdf-download";
import { getCommercialPdfAndroidSupport, type PreparedAndroidCommercialPdf } from "@/features/commercial/native-commercial-pdf";

export interface CommercialShareDialogProps {
  title: string;
  file: File | null;
  lease: CommercialPdfLease | null;
  mode: "share" | "download";
  nativePdf: PreparedAndroidCommercialPdf | null;
  preparing: boolean;
  error: string | null;
  onPrepare: () => void;
  onClose: () => void;
}

export function CommercialShareDialog({ title, file, lease, mode, nativePdf, preparing, error, onPrepare, onClose }: CommercialShareDialogProps) {
  const l = useCommercialLabels();
  const [action, setAction] = useState<"share" | "save" | null>(null);
  const sharing = action !== null;
  const [saveError, setSaveError] = useState<File | null>(null);
  const [shareError, setShareError] = useState<File | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const current = useRef({ file, title, nativePdf, onClose });

  useLayoutEffect(() => { current.current = { file, title, nativePdf, onClose }; }, [file, title, nativePdf, onClose]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const androidSupport = getCommercialPdfAndroidSupport();
  const androidApp = androidSupport !== "browser";
  const ready = !preparing && !error && isCommercialPdfFile(file) && (!androidApp || nativePdf !== null);
  const nativeShare = !androidApp && ready && typeof navigator !== "undefined" && canShareCommercialPdf(navigator, file);
  const failed = shareError !== null && shareError === file;

  function close() {
    if (!pending.current) onClose();
  }

  function share() {
    if (!ready || !file || pending.current) return;
    const sharedFile = file;
    const sharedTitle = title;
    pending.current = true;
    setAction("share");
    setSaveError(null);
    setShareError(null);
    let result: Promise<void>;
    try {
      // Do not await PDF preparation or imports here: this call must retain the click gesture.
      result = shareCommercialPdf(navigator, sharedFile, sharedTitle);
    } catch (cause) {
      result = Promise.reject(cause);
    }
    const stillCurrent = () => mounted.current && current.current.file === sharedFile && current.current.title === sharedTitle;
    void result.then(() => {
      if (stillCurrent()) current.current.onClose();
    }).catch((cause: unknown) => {
      if (stillCurrent() && !isCommercialShareCancelled(cause)) setShareError(sharedFile);
    }).finally(() => {
      pending.current = false;
      if (mounted.current) setAction(null);
    });
  }

  function runNative(nextAction: "share" | "save") {
    if (!ready || !file || !nativePdf || pending.current) return;
    const sharedFile = file;
    const prepared = nativePdf;
    const stillCurrent = () => mounted.current && current.current.file === sharedFile && current.current.nativePdf === prepared;
    pending.current = true;
    setAction(nextAction);
    setShareError(null);
    setSaveError(null);
    let result: Promise<void | "saved" | "cancelled">;
    try {
      result = nextAction === "share" ? prepared.share() : prepared.save();
    } catch (cause) { result = Promise.reject(cause); }
    void result.then(status => {
      if (stillCurrent() && (nextAction === "share" || status === "saved")) current.current.onClose();
    }).catch(() => {
      // Native user cancellation is the explicit "cancelled" save result.
      // A rejected current handle (including expiry) needs a visible reprepare action.
      if (stillCurrent()) {
        if (nextAction === "share") setShareError(sharedFile);
        else setSaveError(sharedFile);
      }
    }).finally(() => {
      pending.current = false;
      if (mounted.current) setAction(null);
    });
  }

  function transfer(event: MouseEvent<HTMLAnchorElement>) {
    if (!ready || pending.current || !lease?.transfer()) {
      event.preventDefault();
      if (!pending.current && ready) onPrepare();
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="font-lao sm:max-w-lg" showCloseButton={!sharing} onEscapeKeyDown={(event) => { if (pending.current) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{l(mode === "share" ? "sharePdf" : "downloadPdf")}</DialogTitle>
          <DialogDescription>{l(mode === "share" ? "shareChannelsHint" : androidApp ? "nativePdfSaveHint" : "downloadReadyHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-4 px-1">
          <p className="text-sm text-muted-foreground">{l("shareVisibleDetailsHint")}</p>
          {preparing ? <div role="status" className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"><LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" /><span>{l("sharePreparing")}</span></div> : ready ? <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4"><FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><p className="font-medium">{l("pdfReady")}</p><p className="mt-1 break-all text-sm text-muted-foreground">{file?.name}</p></div></div> : null}
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          {failed ? <Alert variant="destructive"><AlertDescription>{l("shareFailed")}</AlertDescription></Alert> : null}
          {androidSupport === "update-required" ? <Alert><AlertDescription>{l("androidPdfUpdateHint")}</AlertDescription></Alert> : ready ? <p className="text-sm text-muted-foreground">{androidApp ? l(mode === "download" ? "nativePdfSaveHint" : "nativePdfReadyHint") : mode === "download" ? l("downloadOpenHint") : nativeShare && !failed ? l("shareNativeHint") : l("shareFallbackHint")}</p> : null}
          {saveError !== null && saveError === file ? <Alert variant="destructive"><AlertDescription>{l("nativePdfSaveFailed")}</AlertDescription></Alert> : null}
          {sharing ? <p role="status" className="text-sm text-muted-foreground">{l(action === "save" ? "nativePdfSaving" : "shareOpening")}</p> : null}
        </div>
        <DialogFooter className="flex-wrap">
          <Button className="min-h-11" type="button" variant="outline" onClick={close} disabled={sharing}>{l("close")}</Button>
          {androidSupport !== "update-required" && !preparing && (!ready || (androidApp && (failed || saveError === file && file !== null))) ? <Button className="min-h-11" type="button" disabled={sharing} onClick={() => { if (!pending.current) onPrepare(); }}>{l("retry")}</Button> : null}
          {ready && !androidApp && lease ? <><Button className="min-h-11" asChild variant="outline" disabled={sharing}><a href={lease.url} target="_blank" rel="noopener" onClick={transfer} aria-disabled={sharing}><ExternalLink aria-hidden="true" />{l("openPdf")}</a></Button><Button className="min-h-11" asChild variant={mode === "share" && nativeShare && !failed ? "outline" : "default"} disabled={sharing}><a href={lease.url} download={file?.name} onClick={transfer} aria-disabled={sharing}><Download aria-hidden="true" />{l("downloadPdf")}</a></Button></> : null}
          {ready && nativePdf ? <Button className="min-h-11" type="button" variant={mode === "share" ? "outline" : "default"} onClick={() => runNative("save")} disabled={sharing}><Download aria-hidden="true" />{l("nativePdfSave")}</Button> : null}
          {mode === "share" && ready && nativePdf ? <Button className="min-h-11" type="button" onClick={() => runNative("share")} disabled={sharing}><Share2 aria-hidden="true" />{l("sharePdf")}</Button> : null}
          {mode === "share" && ready && nativeShare ? <Button className="min-h-11" type="button" onClick={share} disabled={sharing}>{sharing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Share2 aria-hidden="true" />}{l("sharePdf")}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
