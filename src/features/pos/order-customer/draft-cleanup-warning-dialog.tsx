"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// เตือนก่อน inactivity timeout จะ cleanup รายการที่ยังไม่ยืนยันของตัวเองอัตโนมัติ
// (ดู use-draft-cleanup.ts) — ปิด dialog ด้วยการกดปุ่มใดปุ่มหนึ่งเท่านั้น ไม่ให้
// กดพื้นหลัง/Esc ปิดเฉยๆ เพราะเป็นการตัดสินใจสำคัญ (จะเสียรายการหรือไม่)
export function DraftCleanupWarningDialog({
  open,
  secondsLeft,
  onConfirmOrder,
  onKeepGoing,
  onDiscardNow,
}: {
  open: boolean;
  secondsLeft: number;
  onConfirmOrder: () => void;
  onKeepGoing: () => void;
  onDiscardNow: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-sm"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("pos.draftCleanupWarningTitle")}</DialogTitle>
          <DialogDescription>
            {t("pos.draftCleanupWarningDescription", { count: secondsLeft })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" className="w-full" onClick={onConfirmOrder}>
            {t("pos.confirmOrderAction")}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={onKeepGoing}>
            {t("pos.draftCleanupKeepGoing")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive hover:text-destructive"
            onClick={onDiscardNow}
          >
            {t("pos.draftCleanupDiscardNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
