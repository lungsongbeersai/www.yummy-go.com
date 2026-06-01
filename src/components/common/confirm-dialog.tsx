"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import type { ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface ConfirmDialogProps {
  cancelLabel: string;
  confirmDisabled?: boolean;
  confirmLabel: string;
  confirmPending?: boolean;
  confirmVariant?: ButtonProps["variant"];
  description: string;
  open: boolean;
  title: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  cancelLabel,
  confirmDisabled = false,
  confirmLabel,
  confirmPending = false,
  confirmVariant = "danger",
  description,
  open,
  title,
  onConfirm,
  onOpenChange
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirmPending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction disabled={confirmDisabled || confirmPending} variant={confirmVariant} onClick={onConfirm}>
            {confirmPending ? <Spinner data-icon="inline-start" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
