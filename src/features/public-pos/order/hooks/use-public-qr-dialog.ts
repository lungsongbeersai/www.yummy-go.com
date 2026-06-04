"use client";

import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";
import type { QRScanResponse } from "@/services/public-pos";
import type { ToastInput } from "@/stores/toast-store";
import { publicQrDownloadFilename } from "@/features/public-pos/order/utils";

export function usePublicQrDialog({
  table,
  t,
  toast,
}: {
  table: QRScanResponse | null;
  t: TFunction;
  toast: (toast: ToastInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [dataUrl, setDataUrl] = useState("");

  const handleOpen = useCallback(() => {
    setTargetUrl(window.location.href);
    setDataUrl("");
    setOpen(true);
  }, []);

  const handleShare = useCallback(() => {
    if (!targetUrl) return;

    const title = `Yummy Go - ${table?.table_name ?? ""}`;
    const url = targetUrl;

    if (navigator.share) {
      void navigator.share({ title, url }).catch(() => undefined);
      return;
    }

    void navigator.clipboard.writeText(url).then(() => {
      toast({ title: t("dashboard.copied"), tone: "success" });
    });
  }, [targetUrl, t, table?.table_name, toast]);

  const handleDownload = useCallback(() => {
    if (!dataUrl) return;

    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = publicQrDownloadFilename(table?.table_name);
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }, [dataUrl, table?.table_name]);

  useEffect(() => {
    if (!open || !targetUrl) {
      if (!open) setDataUrl("");
      return;
    }

    let ignore = false;

    import("qrcode")
      .then((mod) =>
        mod.default.toDataURL(targetUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
        }),
      )
      .then((nextDataUrl) => {
        if (!ignore) setDataUrl(nextDataUrl);
      })
      .catch(() => {
        if (!ignore) setDataUrl("");
      });

    return () => {
      ignore = true;
    };
  }, [open, targetUrl]);

  return {
    qrDialogOpen: open,
    qrTargetUrl: targetUrl,
    qrDataUrl: dataUrl,
    setQrDialogOpen: setOpen,
    handleOpenQrDialog: handleOpen,
    handleShareQr: handleShare,
    handleDownloadQr: handleDownload,
  };
}
