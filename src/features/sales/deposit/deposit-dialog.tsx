"use client";

import { useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { PackageOpen, Wine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CartItem } from "@/services/pos";
import { useDepositStore } from "@/stores/deposit-store";
import { DepositCreateForm } from "./deposit-create-form";
import { DepositWithdrawForm } from "./deposit-withdraw-form";

export type DepositDialogTab = "create" | "withdraw";

export function DepositDialog({
  branchUuid,
  defaultTab,
  open,
  onOpenChange,
  orderItems,
  orderUuid
}: {
  branchUuid?: string;
  defaultTab: DepositDialogTab;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItems: CartItem[];
  orderUuid?: string;
}) {
  const { t } = useTranslation();
  const saving = useDepositStore((state) => state.saving);
  const withdrawing = useDepositStore((state) => state.withdrawing);
  const [activeTab, setActiveTab] = useState<DepositDialogTab>(defaultTab);

  // เปิด dialog ใหม่ทุกครั้ง = เริ่มที่ tab ที่ผู้ใช้ตั้งใจกด (ฝาก vs เบิก)
  useResetOnChange(`${open}:${defaultTab}`, () => {
    if (open) setActiveTab(defaultTab);
  });

  const busy = saving || withdrawing;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent showCloseButton={!busy} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
              <Wine className="size-4" aria-hidden />
            </span>
            {t("deposit.dialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("deposit.subtitle")}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DepositDialogTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">
              <Wine data-icon="inline-start" />
              {t("deposit.createTitle")}
            </TabsTrigger>
            <TabsTrigger value="withdraw">
              <PackageOpen data-icon="inline-start" />
              {t("deposit.withdrawTitle")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <DepositCreateForm branchUuid={branchUuid} open={open} orderItems={orderItems} onOpenChange={onOpenChange} />
          </TabsContent>
          <TabsContent value="withdraw">
            <DepositWithdrawForm branchUuid={branchUuid} open={open} orderUuid={orderUuid} onOpenChange={onOpenChange} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
