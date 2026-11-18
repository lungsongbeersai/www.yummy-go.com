"use client";

import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { isCapacitorAndroidApp } from "@/lib/capacitor-platform";
import { useExportCurrent } from "@/hooks/use-export-current";
import { saveExportFile } from "@/lib/export/file-output";
import { useToastStore } from "@/stores/toast-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ProductMenuDownloadFile {
  file: File;
  url: string;
  filename: string;
  itemCount: number;
  pageCount: number;
  imageOmissions: number;
  secureContext: boolean;
}

export interface ProductMenuDownloadDialogProps {
  file: ProductMenuDownloadFile | null;
  onOpenChange: (open: boolean) => void;
}

export function ProductMenuDownloadDialog({ file, onOpenChange }: ProductMenuDownloadDialogProps) {
  const { t } = useTranslation();
  const nativeApp = useIsCapacitorNativeApp() && isCapacitorAndroidApp();
  const [saving, setSaving] = useState(false);
  const isCurrent = useExportCurrent(file?.url ?? "");
  const showToast = useToastStore(state => state.show);

  async function save() {
    if (!file || saving || !isCurrent()) return;
    setSaving(true);
    try { await saveExportFile(file.file, { isCurrent }); }
    catch (error) {
      if (isCurrent() && !(error instanceof Error && error.name === "AbortError")) {
        showToast({ title: t("product.menuPdf.failed"), description: error instanceof Error ? error.message : "", tone: "error" });
      }
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      {file ? <DialogContent className="font-lao gap-5 p-5 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>{t("product.menuPdf.ready.title")}</DialogTitle>
          <DialogDescription>{t("product.menuPdf.ready.summary", { count: file.itemCount, pages: file.pageCount })}</DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-3">
          <p className="break-all text-sm">{file.filename}</p>
          {file.imageOmissions > 0 ? <p className="text-xs leading-relaxed text-muted-foreground">
            {t("product.menuPdf.ready.missingPhotos", { count: file.imageOmissions })}
          </p> : null}
          {!file.secureContext ? <p className="text-xs leading-relaxed text-muted-foreground">
            {t("product.menuPdf.ready.insecureContext")}
          </p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" className="min-h-11 sm:mr-auto" onClick={() => onOpenChange(false)}>
            {t("actions.close")}
          </Button>
          {!nativeApp ? <Button asChild variant="outline" className="min-h-11">
            <a href={file.url} target="_blank" rel="noopener">{t("product.menuPdf.ready.open")}</a>
          </Button> : null}
          <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
            {t("product.menuPdf.ready.download")}
          </Button>
        </DialogFooter>
      </DialogContent> : null}
    </Dialog>
  );
}
