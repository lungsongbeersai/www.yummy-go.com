"use client";

import type { RefObject } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Printer,
  RefreshCcw,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ReportBranchOption } from "../shared/report-branch-options";
import { ReportDateInput } from "../shared/report-date-input";
import type { DailyClosingReportFilters } from "./daily-closing-report-types";

interface DailyClosingReportControlsProps {
  actionsRef: RefObject<HTMLDivElement | null>;
  balanced: boolean | null;
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportBranchOption[];
  canApply: boolean;
  disabled: boolean;
  draftFilters: DailyClosingReportFilters;
  loading: boolean;
  printDisabled: boolean;
  printing: boolean;
  refreshDisabled: boolean;
  onApply: () => void;
  onDraftChange: (filters: DailyClosingReportFilters) => void;
  onPrint: () => void;
  onRefresh: () => void;
}

export function DailyClosingReportControls({
  actionsRef,
  balanced,
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  disabled,
  draftFilters,
  loading,
  printDisabled,
  printing,
  refreshDisabled,
  onApply,
  onDraftChange,
  onPrint,
  onRefresh,
}: DailyClosingReportControlsProps) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-end">
          <form
            aria-label={t("report.dailyClosing.closingContext")}
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              onApply();
            }}
          >
            <FieldGroup className="grid gap-3 md:grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1fr)_auto] md:items-end">
              <Field className="gap-1.5" data-disabled={branchLocked || disabled}>
                <FieldLabel htmlFor="daily-closing-branch">
                  {t("fields.branch_uuid_fk")}
                </FieldLabel>
                <Select
                  value={draftFilters.branchUuid}
                  disabled={branchLocked || branchLoading || disabled}
                  onValueChange={(branchUuid) =>
                    onDraftChange({ ...draftFilters, branchUuid })
                  }
                >
                  <SelectTrigger
                    id="daily-closing-branch"
                    className="h-11 w-full sm:h-10"
                  >
                    <SelectValue placeholder={t("report.dailyClosing.selectBranch")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {branchOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field className="gap-1.5" data-disabled={disabled}>
                <FieldLabel htmlFor="daily-closing-date">
                  {t("report.dailyClosing.businessDate")}
                </FieldLabel>
                <ReportDateInput
                  id="daily-closing-date"
                  label={t("report.dailyClosing.businessDate")}
                  className="h-11 sm:h-10"
                  value={draftFilters.date}
                  disabled={disabled}
                  onValueChange={(date) =>
                    onDraftChange({ ...draftFilters, date })
                  }
                />
              </Field>

              <Button
                type="submit"
                className="h-11 sm:h-10"
                disabled={!canApply || disabled}
              >
                <Search data-icon="inline-start" aria-hidden="true" />
                {t("report.apply")}
              </Button>
            </FieldGroup>
          </form>

          <div
            ref={actionsRef}
            className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end 2xl:shrink-0"
          >
            {balanced !== null ? (
              <Badge
                variant={balanced ? "outline" : "destructive"}
                className={cn(
                  "min-h-8 justify-center px-3",
                  balanced && "border-primary text-primary",
                )}
              >
                {balanced ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : (
                  <AlertCircle aria-hidden="true" />
                )}
                {balanced
                  ? t("report.dailyClosing.balancedShort")
                  : t("report.dailyClosing.reviewRequired")}
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:h-10 sm:w-auto"
              disabled={refreshDisabled}
              onClick={onRefresh}
            >
              <RefreshCcw
                data-icon="inline-start"
                className={loading ? "animate-spin" : undefined}
                aria-hidden="true"
              />
              {t("actions.refresh")}
            </Button>
            <Button
              type="button"
              className="h-11 w-full sm:h-10 sm:w-auto"
              disabled={printDisabled}
              onClick={onPrint}
            >
              {printing ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : (
                <Printer data-icon="inline-start" aria-hidden="true" />
              )}
              {t("report.dailyClosing.printClosingReport")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
