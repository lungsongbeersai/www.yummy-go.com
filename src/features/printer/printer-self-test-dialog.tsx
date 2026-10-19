"use client";

import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { PrinterSelfTestInput } from "@/services/printer";

interface PrinterSelfTestDialogProps {
  pendingSelfTest: PrinterSelfTestInput | null;
  printing: boolean;
  onReady: () => Promise<void>;
}

export function PrinterSelfTestDialog({ pendingSelfTest, printing, onReady }: PrinterSelfTestDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={Boolean(pendingSelfTest)}>
      <AlertDialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("printer.selfTestWaitTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("printer.selfTestWaitHint")}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="break-all text-sm text-muted-foreground">{pendingSelfTest?.interface_value}</p>
        <AlertDialogFooter>
          <Button disabled={printing} onClick={() => void onReady()}>
            {printing ? <Spinner data-icon="inline-start" /> : null}
            {t(printing ? "common.processing" : "printer.selfTestPrinterReady")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
