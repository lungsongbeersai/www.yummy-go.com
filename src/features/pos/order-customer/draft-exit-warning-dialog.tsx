"use client";

import { ShoppingBag, Trash2, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
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
        aria-busy={leavePending}
        className="max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] gap-0 overflow-y-auto rounded-2xl p-0 shadow-xl data-[size=default]:max-w-md sm:w-full sm:data-[size=default]:max-w-lg"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader className="gap-3 p-5 pb-4 sm:gap-x-4 sm:p-6 sm:pb-5">
          <AlertDialogMedia className="mb-0 size-12 rounded-full bg-warning/15 text-warning sm:row-span-2">
            <TriangleAlert aria-hidden="true" className="size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-lg leading-7 font-black">
            {t("pos.draftExitWarningTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-6 sm:col-start-2">
            {t("pos.draftExitWarningDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="grid grid-cols-1 gap-2 border-t border-border/70 bg-muted/30 p-4 sm:grid-cols-2 sm:p-5">
          <AlertDialogCancel
            className="min-h-11 w-full px-4 text-sm font-bold sm:min-h-10"
            variant="default"
            disabled={leavePending}
            onClick={onContinue}
          >
            <ShoppingBag aria-hidden="true" data-icon="inline-start" />
            {t("pos.draftExitContinue")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11 w-full px-4 text-sm font-bold sm:min-h-10"
            variant="destructive"
            disabled={leavePending}
            onClick={(event) => {
              event.preventDefault();
              onLeaveTable();
            }}
          >
            {leavePending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Trash2 aria-hidden="true" data-icon="inline-start" />
            )}
            {t("pos.draftExitDiscard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
