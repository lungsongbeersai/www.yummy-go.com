"use client";

import { useId } from "react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { PrinterSelfTestCommandProfile, PrinterSelfTestInput } from "@/services/printer";

const PROFILE_LABELS: Record<PrinterSelfTestCommandProfile, string> = {
  epson: "printer.selfTestProfileEpson",
  xprinter: "printer.selfTestProfileXprinter",
  rongta: "printer.selfTestProfileRongta",
};

interface PrinterSelfTestDialogProps {
  pendingSelfTest: PrinterSelfTestInput | null;
  printing: boolean;
  onReady: () => Promise<void>;
  selection: PrinterSelfTestInput | null;
  profile: PrinterSelfTestCommandProfile;
  onProfileChange: (profile: PrinterSelfTestCommandProfile) => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function PrinterSelfTestDialog({
  pendingSelfTest, printing, onReady, selection, profile, onProfileChange, onConfirm, onCancel,
}: PrinterSelfTestDialogProps) {
  const { t } = useTranslation();
  const profileId = useId();
  return (
    <>
      <AlertDialog open={Boolean(selection) && !pendingSelfTest} onOpenChange={(open) => { if (!open && !printing) onCancel(); }}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("printer.selfTestChooseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("printer.selfTestChooseHint")}</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="break-all text-sm text-muted-foreground">{selection?.interface_value}</p>
          <RadioGroup
            aria-label={t("printer.selfTestChooseTitle")}
            value={profile}
            disabled={printing}
            onValueChange={(value) => { if (value === "epson" || value === "xprinter" || value === "rongta") onProfileChange(value); }}
          >
            {(["epson", "xprinter", "rongta"] as const).map((value) => (
              <Label key={value} htmlFor={`${profileId}-${value}`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3">
                <RadioGroupItem id={`${profileId}-${value}`} value={value} />
                {t(PROFILE_LABELS[value])}
              </Label>
            ))}
          </RadioGroup>
          <AlertDialogFooter>
            <Button className="min-h-11" variant="outline" disabled={printing} onClick={onCancel}>{t("common.cancel")}</Button>
            <Button className="min-h-11" disabled={printing} onClick={() => void onConfirm()}>{t("printer.selfTestAction")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(pendingSelfTest)}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" onEscapeKeyDown={(event) => event.preventDefault()}>
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
    </>
  );
}
