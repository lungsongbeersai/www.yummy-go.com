"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Printer } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { useAppStore } from "@/stores/app-store";
import type { CatalogItem, CommercialDocument, CommercialParty } from "@/services/commercial";
import { renderCommercialCatalog, renderCommercialDocument, type CommercialPrintOptions } from "./commercial-print";

interface OutputFrameProps {
  title: string;
  onClose: () => void;
  initialShowImages: boolean;
  render: (options: CommercialPrintOptions) => string;
}

function CommercialOutputFrame({ title, onClose, initialShowImages, render }: OutputFrameProps) {
  const { t } = useTranslation();
  const laoFont = useAppStore(state => state.laoFont);
  const [showImages, setShowImages] = useState(initialShowImages);
  const [showLogo, setShowLogo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loadedPreview, setLoadedPreview] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const previewKey = `${title}:${laoFont}:${showImages}:${showLogo}`;
  const previewReady = loadedPreview === previewKey;
  const options: CommercialPrintOptions = { showImages, showLogo, laoFont, baseUrl: typeof window === "undefined" ? undefined : window.location.origin };
  const print = async () => {
    setError(null);
    try {
      const target = frame.current?.contentWindow;
      if (!target || !frame.current?.contentDocument) throw new Error("preview_unavailable");
      await target.document.fonts.ready;
      await Promise.all(Array.from(target.document.images, image => image.decode()));
      target.focus();
      target.print();
    } catch {
      setError(t("commercial.printFailed", { defaultValue: "ພິມບໍ່ສໍາເລັດ. ກະລຸນາດາວໂຫຼດ PDF ແລ້ວພິມຈາກໄຟລ໌." }));
    }
  };
  const download = async () => {
    if (exporting) return;
    setError(null);
    setExporting(true);
    try {
      const source = frame.current?.contentDocument;
      if (!source) throw new Error("preview_unavailable");
      const { downloadCommercialPdf } = await import("@/features/commercial/commercial-pdf");
      await downloadCommercialPdf(source, title.replace(/[\\/:*?"<>|]/g, "-") || "commercial-document");
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : "";
      setError(`${t("commercial.pdfFailed", { defaultValue: "ສ້າງ PDF ບໍ່ສໍາເລັດ. ກະລຸນາກວດຮູບ ແລະ ຄວາມຍາວຂອງລາຍການ ແລ້ວລອງໃໝ່." })}${detail ? ` (${detail})` : ""}`);
    } finally { setExporting(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !exporting) onClose(); }}>
    <DialogContent showCloseButton={!exporting} className="w-[calc(100%-1rem)] max-w-6xl gap-3 p-3 sm:max-w-6xl sm:p-5">
      <DialogHeader>
        <DialogTitle className="font-lao">{title}</DialogTitle>
        <DialogDescription className="font-lao">{t("commercial.documentOutputHint", { defaultValue: "ເອກະສານ A4 · ເລືອກສະແດງຮູບ ແລ້ວພິມ ຫຼື ດາວໂຫຼດ PDF." })}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-4 font-lao">
        <label className="flex min-h-11 cursor-pointer items-center gap-2"><Checkbox disabled={exporting} checked={showImages} onCheckedChange={value => setShowImages(value === true)} />{t("commercial.showImages", { defaultValue: "ສະແດງຮູບສິນຄ້າ" })}</label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2"><Checkbox disabled={exporting} checked={showLogo} onCheckedChange={value => setShowLogo(value === true)} />{t("commercial.showLogo", { defaultValue: "ສະແດງໂລໂກ້" })}</label>
        <div className="flex flex-wrap gap-2 sm:ml-auto">{!isCapacitorNativeApp() ? <Button type="button" variant="outline" className="min-h-11" disabled={exporting || !previewReady} onClick={() => { void print(); }}><Printer />{t("commercial.print", { defaultValue: "ພິມ" })}</Button> : null}
        <Button type="button" className="min-h-11" disabled={exporting || !previewReady} onClick={() => { void download(); }}><Download />{t(exporting ? "commercial.saving" : "commercial.downloadPdf", { defaultValue: exporting ? "ກໍາລັງບັນທຶກ…" : "ດາວໂຫຼດ PDF" })}</Button></div>
      </div>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <iframe key={previewKey} ref={frame} title={title} srcDoc={render(options)} onLoad={() => setLoadedPreview(previewKey)} sandbox="allow-same-origin allow-modals" className="h-[62dvh] w-full rounded-md border border-border bg-background" />
    </DialogContent>
  </Dialog>;
}

export function CommercialDocumentOutput({ document, onClose }: { document: CommercialDocument; onClose: () => void }) {
  return <CommercialOutputFrame title={document.number} onClose={onClose} initialShowImages={document.show_images} render={options => renderCommercialDocument(document, options)} />;
}

export function CommercialCatalogOutput({ items, branchName, issuer, onClose, showImages = true }: { items: CatalogItem[]; branchName: string; issuer?: CommercialParty; onClose: () => void; showImages?: boolean }) {
  return <CommercialOutputFrame title={branchName} onClose={onClose} initialShowImages={showImages} render={options => renderCommercialCatalog(items, branchName, issuer, options)} />;
}
