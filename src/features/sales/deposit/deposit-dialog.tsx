"use client";

import { useEffect, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CartItem } from "@/services/pos";
import type { Customer } from "@/services/customer";
import { useDepositStore } from "@/stores/deposit-store";
import { DepositCreateForm } from "./deposit-create-form";
import { DepositWithdrawForm } from "./deposit-withdraw-form";
import { DepositReceiptStatus } from "./components/deposit-receipt-status";
import { DepositCustomerPicker } from "./components/deposit-customer-picker";

export type DepositDialogTab = "create" | "withdraw";

export function DepositDialog({
  branchUuid,
  defaultTab,
  open,
  onCompleted,
  onOpenChange,
  orderItems,
  orderUuid,
  orderInvoice,
  tableName
}: {
  branchUuid?: string;
  defaultTab: DepositDialogTab;
  open: boolean;
  onCompleted?: () => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  orderItems: CartItem[];
  orderUuid?: string;
  orderInvoice?: string;
  tableName?: string;
}) {
  const { t } = useTranslation();
  const saving = useDepositStore((state) => state.saving);
  const withdrawing = useDepositStore((state) => state.withdrawing);
  const printing = useDepositStore((state) => state.printing);
  const reprinting = useDepositStore((state) => state.reprinting);
  const lastReceipt = useDepositStore((state) => state.lastReceipt);
  const clearReceipt = useDepositStore((state) => state.clearReceipt);
  const [activeTab, setActiveTab] = useState<DepositDialogTab>(defaultTab);
  const [customer, setCustomer] = useState<Customer | null>(null);

  // เปิด dialog ใหม่ทุกครั้ง = เริ่มที่ tab ที่ผู้ใช้ตั้งใจกด (ฝาก vs เบิก)
  useResetOnChange(`${open}:${defaultTab}`, () => {
    if (open) setActiveTab(defaultTab);
  });

  useResetOnChange(`${open}:${branchUuid}:${orderUuid}`, () => {
    setCustomer(null);
  });

  useEffect(() => { if (open) clearReceipt(); }, [branchUuid, clearReceipt, open, orderUuid]);

  const busy = saving || withdrawing || printing || reprinting;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent showCloseButton={!busy} className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 font-lao sm:max-w-4xl">
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 sm:px-6">
          <DialogTitle className="text-base font-semibold">
            {t("deposit.dialogTitle")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">{t("deposit.dialogHint")}</DialogDescription>
          {tableName || orderInvoice ? <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {tableName ? <span>{t("nav.table")}: <span className="font-medium text-foreground">{tableName}</span></span> : null}
            {orderInvoice ? <span>{t("pos.invoice")}: <span className="font-medium tabular-nums text-foreground">{orderInvoice}</span></span> : null}
          </div> : null}
        </DialogHeader>
        {lastReceipt ? <DepositReceiptStatus receipt={lastReceipt} onClose={() => onOpenChange(false)} /> :
        <Tabs className="min-h-0 gap-0" value={activeTab} onValueChange={(value) => { if (!busy && (value === "create" || value === "withdraw")) setActiveTab(value); }}>
          <TabsList variant="line" className="mx-5 w-fit gap-6 p-0 group-data-horizontal/tabs:h-11 sm:mx-6">
            <TabsTrigger value="create" disabled={busy} className="px-0 text-sm">
              {t("deposit.createTitle")}
            </TabsTrigger>
            <TabsTrigger value="withdraw" disabled={busy} className="px-0 text-sm">
              {t("deposit.withdrawTitle")}
            </TabsTrigger>
          </TabsList>
          <div className="shrink-0 border-y border-border bg-muted/15 px-5 py-4 sm:px-6">
            <DepositCustomerPicker allowCreate={activeTab === "create"} disabled={busy} value={customer} onChange={setCustomer} />
            {!customer ? <p className="mt-2 text-xs text-muted-foreground">{t("deposit.customerFirstHint")}</p> : null}
          </div>
          <TabsContent value="create" className="flex min-h-0 flex-col">
            <DepositCreateForm
              branchUuid={branchUuid}
              customer={customer}
              open={open}
              orderItems={orderItems}
              orderUuid={orderUuid}
              onOpenChange={onOpenChange}
            />
          </TabsContent>
          <TabsContent value="withdraw" className="flex min-h-0 flex-col">
            <DepositWithdrawForm
              branchUuid={branchUuid}
              customer={customer}
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
