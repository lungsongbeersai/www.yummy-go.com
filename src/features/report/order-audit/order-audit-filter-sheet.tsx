"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReportBranchField, ReportDateRangeFields, ReportSelectField, type ReportFieldOption } from "@/features/report/shared/report-filter-fields";

export interface OrderAuditDraft {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  action: string;
  entity: string;
}

export function OrderAuditFilterSheet({
  open,
  onOpenChange,
  draft,
  draftBranch,
  onDraftChange,
  branchLoading,
  branchLocked,
  branchOptions,
  actionOptions,
  entityOptions,
  valid,
  dateRangeInvalid,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: OrderAuditDraft;
  draftBranch: string;
  onDraftChange: (updater: (previous: OrderAuditDraft) => OrderAuditDraft) => void;
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportFieldOption[];
  actionOptions: ReportFieldOption[];
  entityOptions: ReportFieldOption[];
  valid: boolean;
  dateRangeInvalid: boolean;
  onApply: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{t("orderAudit.filters")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6">
          <ReportBranchField
            id="audit-branch"
            branchLoading={branchLoading}
            branchLocked={branchLocked}
            options={branchOptions}
            value={draftBranch}
            onValueChange={branchUuid => onDraftChange(previous => ({ ...previous, branchUuid }))}
          />
          <ReportDateRangeFields
            idPrefix="audit"
            dateFrom={draft.dateFrom}
            dateTo={draft.dateTo}
            onDateFromChange={dateFrom => onDraftChange(previous => ({ ...previous, dateFrom }))}
            onDateToChange={dateTo => onDraftChange(previous => ({ ...previous, dateTo }))}
          />
          <ReportSelectField
            id="audit-action"
            label={t("orderAudit.action")}
            value={draft.action}
            options={actionOptions}
            onValueChange={action => onDraftChange(previous => ({ ...previous, action }))}
          />
          <ReportSelectField
            id="audit-entity"
            label={t("orderAudit.entity")}
            value={draft.entity}
            options={entityOptions}
            onValueChange={entity => onDraftChange(previous => ({ ...previous, entity }))}
          />
          {dateRangeInvalid && (
            <p className="text-sm text-destructive" role="alert">{t("orderAudit.invalidDates")}</p>
          )}
        </div>
        <SheetFooter>
          <Button disabled={!valid} onClick={onApply}>{t("actions.search")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
