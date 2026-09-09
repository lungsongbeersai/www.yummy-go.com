"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReportBranchField, ReportDateRangeFields, type ReportFieldOption } from "@/features/report/shared/report-filter-fields";
import { EmployeeCombobox } from "./employee-combobox";
import { useEmployeeOptions } from "./use-employee-options";

export interface EmployeeSalesDraft {
  branchUuid: string;
  loginUuid: string;
  dateFrom: string;
  dateTo: string;
}

export function EmployeeSalesFilterSheet({
  open,
  onOpenChange,
  draft,
  draftBranch,
  onDraftChange,
  branchLoading,
  branchLocked,
  branchOptions,
  valid,
  dateRangeInvalid,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: EmployeeSalesDraft;
  draftBranch: string;
  onDraftChange: (updater: (previous: EmployeeSalesDraft) => EmployeeSalesDraft) => void;
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportFieldOption[];
  valid: boolean;
  dateRangeInvalid: boolean;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  const { options: employees, loading: employeesLoading } = useEmployeeOptions(draftBranch);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{t("report.filters.currentFilters")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6">
          <ReportBranchField
            id="employee-sales-branch"
            branchLoading={branchLoading}
            branchLocked={branchLocked}
            options={branchOptions}
            value={draftBranch}
            onValueChange={branchUuid => onDraftChange(previous => ({ ...previous, branchUuid, loginUuid: "" }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground" htmlFor="employee-sales-employee">
              {t("employeeSales.employee")}
            </label>
            <EmployeeCombobox
              disabled={!draftBranch}
              employees={employees}
              id="employee-sales-employee"
              loading={employeesLoading}
              value={draft.loginUuid}
              onValueChange={loginUuid => onDraftChange(previous => ({ ...previous, loginUuid }))}
            />
          </div>
          <ReportDateRangeFields
            idPrefix="employee-sales"
            dateFrom={draft.dateFrom}
            dateTo={draft.dateTo}
            onDateFromChange={dateFrom => onDraftChange(previous => ({ ...previous, dateFrom }))}
            onDateToChange={dateTo => onDraftChange(previous => ({ ...previous, dateTo }))}
          />
          {dateRangeInvalid && (
            <p className="text-sm text-destructive" role="alert">{t("employeeSales.invalidDateRange")}</p>
          )}
        </div>
        <SheetFooter>
          <Button disabled={!valid} onClick={onApply}>{t("actions.search")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
