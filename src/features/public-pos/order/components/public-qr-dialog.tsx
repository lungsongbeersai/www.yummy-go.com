"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Download, ImageIcon, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PublicQrDialog({
  dataUrl,
  onDownload,
  onOpenChange,
  onShare,
  open,
  tableName,
  targetUrl,
}: {
  dataUrl: string;
  onDownload: () => void;
  onOpenChange: (open: boolean) => void;
  onShare: () => void;
  open: boolean;
  tableName?: string | null;
  targetUrl: string;
}) {
  const { t } = useTranslation();
  const displayTableName = tableName?.trim() || t("pos.qrCode");
  const canShare = Boolean(targetUrl);
  const canDownload = Boolean(dataUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-105">
        <DialogHeader className="px-5 pb-3 pt-5 pr-12 text-left">
          <DialogTitle className="text-xl font-black leading-6">
            {t("pos.qrCode")}
          </DialogTitle>
          <DialogDescription>
            {t("pos.publicQrDescription", { table: displayTableName })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid place-items-center px-5 pb-5">
          <div className="grid place-items-center rounded-2xl border border-border bg-muted/30 p-4 shadow-inner">
            {dataUrl ? (
              <Image
                src={dataUrl}
                alt={`${displayTableName} QR`}
                width={260}
                height={260}
                unoptimized
                className="size-58 rounded-xl bg-background object-contain p-2 shadow-sm sm:size-65"
              />
            ) : targetUrl ? (
              <Skeleton className="size-58 rounded-xl sm:size-65" />
            ) : (
              <div className="grid size-58 place-items-center rounded-xl bg-muted text-muted-foreground sm:size-65">
                <ImageIcon className="size-8" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 p-3 sm:p-4">
          <div className="grid w-full grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-w-0 rounded-xl px-4 font-black"
                  disabled={!canShare}
                  onClick={onShare}
                >
                  <Share2 data-icon="inline-start" className="size-4" />
                  <span className="truncate">{t("pos.shareQr")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {t("pos.shareQr")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  className="h-11 min-w-0 rounded-xl px-4 font-black"
                  disabled={!canDownload}
                  onClick={onDownload}
                >
                  <Download data-icon="inline-start" className="size-4" />
                  <span className="truncate">{t("pos.downloadQr")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {t("pos.downloadQr")}
              </TooltipContent>
            </Tooltip>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
