"use client";

import { useEffect, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Wine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CartItem } from "@/services/pos";
import { useDepositStore } from "@/stores/deposit-store";
import { DepositCreateForm } from "./deposit-create-form";
import { DepositWithdrawForm } from "./deposit-withdraw-form";
import { DepositReceiptStatus } from "./components/deposit-receipt-status";

export type DepositDialogTab = "create" | "withdraw";

export function DepositDialog({
  branchUuid,
  defaultTab,
  open,
  onCompleted,
  onOpenChange,
  orderItems,
  orderUuid
}: {
  branchUuid?: string;
  defaultTab: DepositDialogTab;
  open: boolean;
  onCompleted?: () => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  orderItems: CartItem[];
  orderUuid?: string;
}) {
  const { t } = useTranslation();
  const saving = useDepositStore((state) => state.saving);
  const withdrawing = useDepositStore((state) => state.withdrawing);
  const printing = useDepositStore((state) => state.printing);
  const reprinting = useDepositStore((state) => state.reprinting);
  const lastReceipt = useDepositStore((state) => state.lastReceipt);
  const clearReceipt = useDepositStore((state) => state.clearReceipt);
  const [activeTab, setActiveTab] = useState<DepositDialogTab>(defaultTab);

  // เปิด dialog ใหม่ทุกครั้ง = เริ่มที่ tab ที่ผู้ใช้ตั้งใจกด (ฝาก vs เบิก)
  useResetOnChange(`${open}:${defaultTab}`, () => {
    if (open) setActiveTab(defaultTab);
  });

  useEffect(() => { if (open) clearReceipt(); }, [clearReceipt, open]);

  const busy = saving || withdrawing || printing || reprinting;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent showCloseButton={!busy} className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 font-lao sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Wine className="size-4 text-muted-foreground" aria-hidden />
            {t("deposit.dialogTitle")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">{t("deposit.dialogHint")}</DialogDescription>
        </DialogHeader>
        {lastReceipt ? <DepositReceiptStatus receipt={lastReceipt} onClose={() => onOpenChange(false)} /> :
        <Tabs className="min-h-0 gap-0" value={activeTab} onValueChange={(value) => { if (!busy && (value === "create" || value === "withdraw")) setActiveTab(value); }}>
          <TabsList className="mx-5 mt-4 grid h-10 w-auto grid-cols-2 sm:mx-6">
            <TabsTrigger value="create" disabled={busy}>
              {t("deposit.createTitle")}
            </TabsTrigger>
            <TabsTrigger value="withdraw" disabled={busy}>
              {t("deposit.withdrawTitle")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="flex min-h-0 flex-col">
            <DepositCreateForm
              branchUuid={branchUuid}
              open={open}
              orderItems={orderItems}
              orderUuid={orderUuid}
              onOpenChange={onOpenChange}
            />
          </TabsContent>
          <TabsContent value="withdraw" className="flex min-h-0 flex-col">
            <DepositWithdrawForm
              branchUuid={branchUuid}
              open={open}
              orderUuid={orderUuid}
              onCompleted={onCompleted}
              onOpenChange={onOpenChange}
            />
          </TabsContent>
        </Tabs>}
      </DialogContent>
    </Dialog>
  );
}
