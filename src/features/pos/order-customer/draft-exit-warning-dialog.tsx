"use client";

import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

export function DraftExitWarningDialog({
  leavePending,
  open,
  onContinue,
  onLeaveTable,
}: {
  leavePending: boolean;
  open: boolean;
  onContinue: () => void;
  onLeaveTable: () => void;
}) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("pos.draftExitWarningTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("pos.draftExitWarningDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={leavePending} onClick={onContinue}>
            {t("pos.draftExitContinue")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={leavePending}
            onClick={(event) => {
              event.preventDefault();
              onLeaveTable();
            }}
          >
            {leavePending ? <Spinner data-icon="inline-start" /> : null}
            {t("pos.draftExitDiscard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
