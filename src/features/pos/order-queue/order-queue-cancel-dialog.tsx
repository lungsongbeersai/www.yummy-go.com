"use client";

import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

interface OrderQueueCancelDialogProps {
  cancelling: boolean;
  count: number;
  open: boolean;
  reason: string;
  reasonInvalid: boolean;
  onOpenChange: (open: boolean) => void;
  onReasonBlur: () => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
}

export function OrderQueueCancelDialog({
  cancelling,
  count,
  open,
  reason,
  reasonInvalid,
  onOpenChange,
  onReasonBlur,
  onReasonChange,
  onSubmit
}: OrderQueueCancelDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 sm:max-w-lg">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader className="border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{t("orderQueue.cancelDialogTitle")}</DialogTitle>
            <DialogDescription>{t("orderQueue.cancelDialogDescription", { count })}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            <FieldGroup>
              <Field data-invalid={reasonInvalid} className="gap-2">
                <FieldLabel htmlFor="order-queue-cancel-reason">{t("orderQueue.cancelReasonLabel")}</FieldLabel>
                <Textarea
                  id="order-queue-cancel-reason"
                  aria-invalid={reasonInvalid}
                  disabled={cancelling}
                  value={reason}
                  placeholder={t("orderQueue.cancelReasonPlaceholder")}
                  onBlur={onReasonBlur}
                  onChange={(event) => onReasonChange(event.target.value)}
                />
                {reasonInvalid ? <FieldError>{t("orderQueue.cancelReasonRequired")}</FieldError> : null}
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter className="border-t border-border px-4 py-3 sm:px-6">
            <Button disabled={cancelling} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={cancelling || !reason.trim()} type="submit" variant="destructive">
              {cancelling ? <Spinner data-icon="inline-start" /> : <Ban data-icon="inline-start" />}
              {t("orderQueue.cancelDialogConfirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
