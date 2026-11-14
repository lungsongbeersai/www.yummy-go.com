"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download, FileText, LoaderCircle, Share2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { canShareCommercialPdf, isCommercialPdfFile, isCommercialShareCancelled, shareCommercialPdf } from "@/features/commercial/commercial-share";
import { downloadCommercialPdfFile, type CommercialPdfDownload } from "@/features/commercial/commercial-pdf-download";

export interface CommercialShareDialogProps {
  title: string;
  file: File | null;
  preparing: boolean;
  error: string | null;
  onPrepare: () => void;
  onClose: () => void;
}

export function CommercialShareDialog({ title, file, preparing, error, onPrepare, onClose }: CommercialShareDialogProps) {
  const l = useCommercialLabels();
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<File | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const current = useRef({ file, title, onClose });
  const downloads = useRef(new Set<CommercialPdfDownload>());

  useLayoutEffect(() => { current.current = { file, title, onClose }; }, [file, title, onClose]);
  useEffect(() => {
    mounted.current = true;
    const activeDownloads = downloads.current;
    return () => {
      mounted.current = false;
      activeDownloads.forEach(download => download.dispose());
      activeDownloads.clear();
    };
  }, []);

  const ready = !preparing && !error && isCommercialPdfFile(file);
  const nativeShare = ready && typeof navigator !== "undefined" && canShareCommercialPdf(navigator, file);
  const failed = shareError !== null && shareError === file;

  function close() {
    if (!pending.current) onClose();
  }

  function share() {
    if (!ready || !file || pending.current) return;
    const sharedFile = file;
    const sharedTitle = title;
    pending.current = true;
    setSharing(true);
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
      if (mounted.current) setSharing(false);
    });
  }

  function download() {
    if (!ready || !file || pending.current) return;
    try {
      const result = downloadCommercialPdfFile(file, () => mounted.current && current.current.file === file);
      downloads.current.add(result);
      void result.released.then(() => downloads.current.delete(result));
    } catch (cause) { if (!isCommercialShareCancelled(cause)) setShareError(file); }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="font-lao sm:max-w-lg" showCloseButton={!sharing} onEscapeKeyDown={(event) => { if (pending.current) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{l("sharePdf")}</DialogTitle>
          <DialogDescription>{l("shareChannelsHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-4 px-1">
          <p className="text-sm text-muted-foreground">{l("shareVisibleDetailsHint")}</p>
          {preparing ? <div role="status" className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"><LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" /><span>{l("sharePreparing")}</span></div> : ready ? <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4"><FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><p className="font-medium">{l("shareReady")}</p><p className="mt-1 break-all text-sm text-muted-foreground">{file?.name}</p></div></div> : null}
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          {failed ? <Alert variant="destructive"><AlertDescription>{l("shareFailed")}</AlertDescription></Alert> : null}
          {ready ? <p className="text-sm text-muted-foreground">{nativeShare && !failed ? l("shareNativeHint") : l("shareFallbackHint")}</p> : null}
          {sharing ? <p role="status" className="text-sm text-muted-foreground">{l("shareOpening")}</p> : null}
        </div>
        <DialogFooter className="flex-wrap">
          <Button type="button" variant="outline" onClick={close} disabled={sharing}>{l("close")}</Button>
          {!preparing && !ready ? <Button type="button" onClick={onPrepare}>{l("retry")}</Button> : null}
          {ready ? <Button type="button" variant={nativeShare && !failed ? "outline" : "default"} onClick={download} disabled={sharing}><Download aria-hidden="true" />{l("downloadPdf")}</Button> : null}
          {ready && nativeShare ? <Button type="button" onClick={share} disabled={sharing}>{sharing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Share2 aria-hidden="true" />}{l("sharePdf")}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
