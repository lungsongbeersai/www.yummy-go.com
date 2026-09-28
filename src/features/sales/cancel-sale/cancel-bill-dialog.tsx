"use client";

import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CANCEL_REASON_PRESETS,
  billDay,
  billInvoice,
  billItems,
  billQtyTotal,
  billTotal,
  cleanText,
  readFromBillSections,
  type BillSource
} from "./cancel-sale-utils";

/**
 * ยกเลิกบิล = เงินจริงหายออกจากยอดขาย จึงใช้ AlertDialog (ไม่ปิดเมื่อคลิกนอกกรอบ) ตาม CLAUDE.md
 * ก่อนหน้านี้เป็น Dialog ธรรมดา — แสดงบิลที่กำลังจะยกเลิกซ้ำอีกรอบ (เลขบิล/โต๊ะ/ยอด) กันยกเลิกผิดใบ
 * และมีปุ่มเหตุผลสำเร็จรูปให้แตะแทนการพิมพ์บนจอสัมผัส ปุ่มปิดใช้คำว่า "ไม่ยกเลิก" แทน "ยกเลิก"
 * ที่เดิมอยู่ข้างปุ่ม "ยืนยันยกเลิก" จนอ่านสับสนว่าปุ่มไหนคือยกเลิกบิล
 */
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
  const invoice = billInvoice(bill);
  const table = cleanText(readFromBillSections([bill], ["table_name", "table_name_la", "table_name_eng", "table_no"], ["order", "self"]));
  const qty = billQtyTotal(bill) ?? billItems(bill).length;
  const meta = [table ? `${t("cancelSale.table")} ${table}` : "", billDay(bill).label, t("pos.itemCount", { count: qty })]
    .filter((value) => value && value !== "-")
    .join(" · ");
  const trimmedReason = reason.trim();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // กำลังยิง API อยู่ห้ามปิด — ปิดกลางทางแล้วผลลัพธ์กลับมาทีหลังจะไม่มีที่ให้แสดง error
        if (!cancelling) onOpenChange(nextOpen);
      }}
    >
      {/* data-[size=default]:sm:max-w-md ต้องเขียนทับด้วย selector เดียวกับฐาน (data-[size=default]:sm:max-w-sm) */}
      <AlertDialogContent className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] gap-0 overflow-hidden p-0 data-[size=default]:max-w-[calc(100vw-2rem)] data-[size=default]:sm:max-w-md">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <AlertDialogHeader className="px-4 pt-4 pb-3 sm:px-5">
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Ban />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-base font-semibold">{t("cancelSale.cancelConfirmTitle", { invoice })}</AlertDialogTitle>
            <AlertDialogDescription>{t("cancelSale.cancelWarning")}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4 sm:px-5">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold tabular-nums text-foreground">{invoice}</span>
                {meta ? <span className="truncate text-xs text-muted-foreground tabular-nums">{meta}</span> : null}
              </div>
              <span className="shrink-0 text-lg font-bold tabular-nums text-foreground">{billTotal(bill)}</span>
            </div>

            <FieldGroup className="gap-3">
              <FieldSet className="gap-2">
                <FieldLegend variant="label" className="mb-0">
                  {t("cancelSale.reasonPresets")}
                </FieldLegend>
                <div className="flex flex-wrap gap-2">
                  {CANCEL_REASON_PRESETS.map((preset) => {
                    const label = t(`cancelSale.reasons.${preset}`);
                    const active = trimmedReason === label;
                    return (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-pressed={active}
                        disabled={cancelling}
                        className={cn("h-9 rounded-full px-3", active && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive")}
                        onClick={() => onReasonChange(label)}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </FieldSet>

              <Field data-invalid={reasonInvalid} className="gap-2">
                <FieldLabel htmlFor="cancel-sale-reason">{t("cancelSale.cancelReason")}</FieldLabel>
                <Textarea
                  id="cancel-sale-reason"
                  aria-invalid={reasonInvalid}
                  disabled={cancelling}
                  value={reason}
                  placeholder={t("cancelSale.cancelReasonPlaceholder")}
                  className="min-h-20"
                  onBlur={onReasonBlur}
                  onChange={(event) => onReasonChange(event.target.value)}
                />
                {reasonInvalid ? (
                  <FieldError>{t("cancelSale.cancelReasonRequired")}</FieldError>
                ) : (
                  <FieldDescription>{t("cancelSale.cancelReasonHelp")}</FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </div>

          <AlertDialogFooter className="border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
            <AlertDialogCancel className="h-11 sm:h-9" disabled={cancelling}>
              {t("cancelSale.keepBill")}
            </AlertDialogCancel>
            {/* ปุ่ม submit ธรรมดา ไม่ใช่ AlertDialogAction — Action ปิด dialog ทันทีที่กด ก่อนรู้ผลจาก API */}
            <Button
              type="submit"
              variant="destructive"
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive hover:brightness-90 sm:h-9 dark:bg-destructive dark:hover:bg-destructive"
              disabled={cancelling || !trimmedReason}
            >
              {cancelling ? <Spinner data-icon="inline-start" /> : <Ban data-icon="inline-start" />}
              {t("cancelSale.confirmCancel")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
