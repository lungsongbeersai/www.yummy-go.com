"use client";

import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
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

    const title = [
      table?.branch_name || t("pos.foodMenu"),
      table?.view_only ? "" : table?.table_name,
    ]
      .filter(Boolean)
      .join(" - ");
    const url = targetUrl;

    if (navigator.share) {
      void navigator.share({ title, url }).catch(() => undefined);
      return;
    }

    void navigator.clipboard.writeText(url).then(() => {
      toast({ title: t("dashboard.copied"), tone: "success" });
    });
  }, [
    targetUrl,
    t,
    table?.branch_name,
    table?.table_name,
    table?.view_only,
    toast,
  ]);

  const handleDownload = useCallback(() => {
    if (!dataUrl) return;

    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = publicQrDownloadFilename(table?.table_name);
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }, [dataUrl, table?.table_name]);

  // ปิด dialog = ทิ้ง QR เดิม (แยกออกจาก effect ที่ไปสร้าง QR ใหม่)
  useResetOnChange(open, () => {
    if (!open) setDataUrl("");
  });

  useEffect(() => {
    if (!open || !targetUrl) return;

    let ignore = false;

    import("qrcode")
      .then((mod) =>
        mod.default.toDataURL(targetUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
        })
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
