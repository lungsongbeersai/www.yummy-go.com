"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BellRing, MapPin, Table2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { internalRoute } from "@/lib/routes";
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useOrderAlertPopupStore } from "@/stores/order-alert-popup-store";

const durationMs = 5000;

export function OrderAlertPopup() {
  const { t } = useTranslation();
  const router = useRouter();
  const alert = useOrderAlertPopupStore((state) => state.alerts[0]);
  const dismiss = useOrderAlertPopupStore((state) => state.dismiss);
  const [remainingMs, setRemainingMs] = useState(durationMs);

  useEffect(() => {
    if (!alert) return;
    const deadline = Date.now() + durationMs;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      setRemainingMs(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        dismiss();
        setRemainingMs(durationMs);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [alert, dismiss]);

  function close() {
    dismiss();
    setRemainingMs(durationMs);
  }

  function openTable() {
    if (!alert) return;
    const params = new URLSearchParams({
      table_uuid: alert.tableUuid,
      table_name: alert.tableName,
      zone_uuid: alert.zoneUuid,
    });
    close();
    useNavigationGuardStore.getState().run(() => {
      router.push(internalRoute(`/posAll/order?${params.toString()}`));
    });
  }

  return (
    <Dialog open={Boolean(alert)} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent showCloseButton={false} overlayClassName="z-60 bg-foreground/40" className="z-61 max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-2xl border border-success/20 bg-background p-6 text-foreground shadow-xl sm:max-w-md">
        <DialogHeader className="items-center gap-3 text-center">
          <span aria-hidden="true" className="flex size-24 items-center justify-center rounded-full bg-success/10 text-success"><BellRing className="size-12" strokeWidth={1.8} /></span>
          <DialogTitle className="text-2xl font-semibold">{t("notifications.title")}</DialogTitle>
          <DialogDescription className="text-center text-base text-foreground">{t("notifications.newOrderPopup.message")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 rounded-xl bg-success/10 px-5 py-4 text-base font-medium">
          <div className="flex items-center gap-3"><MapPin aria-hidden="true" className="size-5 shrink-0 text-success" /><span className="break-words">{t("notifications.newOrderPopup.zone")} : {alert?.zoneName || "—"}</span></div>
          <div className="flex items-center gap-3"><Table2 aria-hidden="true" className="size-5 shrink-0 text-success" /><span className="break-words">{t("pos.table")} : {alert?.tableName || "—"}</span></div>
        </div>
        <div className="grid gap-2">
          <Progress value={remainingMs / durationMs * 100} className="h-2 bg-muted [&_[data-slot=progress-indicator]]:bg-success" />
          <p className="text-center text-sm text-muted-foreground">{t("notifications.newOrderPopup.autoClose", { count: Math.ceil(remainingMs / 1000) })}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={close} variant="outline" className="h-12 rounded-lg text-base font-medium">{t("publicSuccess.close")}</Button>
          <Button autoFocus onClick={openTable} className="h-12 rounded-lg bg-success text-base font-medium text-success-foreground hover:bg-success/90">{t("notifications.newOrderPopup.openTable")}<ArrowRight aria-hidden="true" className="size-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
