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
      <DialogContent className="flex min-h-0 max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex-col gap-0 overflow-hidden rounded-2xl border-yg-line bg-linear-to-b from-yg-bg2 to-yg-bg p-0 font-yg-sans text-yg-ink sm:max-w-105 [&>.ui-overlay-close-button]:size-11">
        <DialogHeader className="shrink-0 px-5 pb-3 pt-5 pr-14 text-left">
          <DialogTitle className="lao-tone-text font-yg-sans text-xl font-semibold leading-snug text-yg-ink">
            {t("pos.qrCode")}
          </DialogTitle>
          <DialogDescription className="text-yg-muted">
            {t("pos.publicQrDescription", { table: displayTableName })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 w-full flex-1 place-items-center overflow-y-auto px-5 pb-5">
          <div className="grid w-full min-w-0 max-w-74 place-items-center rounded-2xl border border-yg-line bg-yg-bg2 p-3 sm:p-4">
            {dataUrl ? (
              <Image
                src={dataUrl}
                alt={`${displayTableName} QR`}
                width={260}
                height={260}
                unoptimized
                // พื้นขาวคงที่ทั้งสองโหมด — QR ต้องมี quiet zone สว่างจึงสแกนติด
                className="aspect-square h-auto w-auto max-h-[min(14.5rem,calc(100dvh_-_16rem))] max-w-full rounded-md bg-white object-contain p-2 sm:max-h-[min(16.25rem,calc(100dvh_-_16rem))]"
              />
            ) : targetUrl ? (
              <Skeleton className="aspect-square w-full max-w-[min(14.5rem,calc(100dvh_-_16rem))] rounded-md sm:max-w-[min(16.25rem,calc(100dvh_-_16rem))]" />
            ) : (
              <div className="grid aspect-square w-full max-w-[min(14.5rem,calc(100dvh_-_16rem))] place-items-center rounded-md bg-yg-panel2 text-yg-faint sm:max-w-[min(16.25rem,calc(100dvh_-_16rem))]">
                <ImageIcon className="size-8" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-yg-line bg-yg-bg p-3.5 sm:p-4">
          <div className="grid w-full grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-w-0 rounded-lg px-4 font-black"
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
                  className="h-11 min-w-0 rounded-lg px-4 font-black"
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
