"use client";

import type { ReactNode } from "react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";

export function SimConfirm({ title, description, children, onConfirm, disabled }: {
  title: string; description: string; children: ReactNode; onConfirm: () => void; disabled?: boolean;
}) {
  const { t } = useTranslation("simulator");
  return <AlertDialog><AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>{t("back")}</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={onConfirm}>{t("confirmAction")}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
