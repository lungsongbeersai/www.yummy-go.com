"use client";

import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  billInvoice,
  type BillSource
} from "./sales-list-utils";

export function CancelBillDialog({
  bill,
  cancelling,
  open,
  reason,
  reasonInvalid,
  onOpenChange,
  onReasonBlur,
  onReasonChange,
  onSubmit
}: {
  bill: BillSource;
  cancelling: boolean;
  open: boolean;
  reason: string;
  reasonInvalid: boolean;
  onOpenChange: (open: boolean) => void;
  onReasonBlur: () => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
}) {
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
            <DialogTitle>{t("cancelSale.cancelBill")}</DialogTitle>
            <DialogDescription>{t("cancelSale.cancelDescription", { invoice: billInvoice(bill) })}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            <FieldGroup>
              <Field data-invalid={reasonInvalid} className="gap-2">
                <FieldLabel htmlFor="sales-list-cancel-reason">{t("cancelSale.cancelReason")}</FieldLabel>
                <Textarea
                  id="sales-list-cancel-reason"
                  aria-invalid={reasonInvalid}
                  disabled={cancelling}
                  value={reason}
                  placeholder={t("cancelSale.cancelReasonPlaceholder")}
                  onBlur={onReasonBlur}
                  onChange={(event) => onReasonChange(event.target.value)}
                />
                <FieldDescription>{t("cancelSale.cancelReasonHelp")}</FieldDescription>
                {reasonInvalid ? <FieldError>{t("cancelSale.cancelReasonRequired")}</FieldError> : null}
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter className="border-t border-border px-4 py-3 sm:px-6">
            <Button disabled={cancelling} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={cancelling || !reason.trim()} type="submit" variant="danger">
              {cancelling ? <Spinner data-icon="inline-start" /> : <Ban data-icon="inline-start" />}
              {t("cancelSale.confirmCancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
