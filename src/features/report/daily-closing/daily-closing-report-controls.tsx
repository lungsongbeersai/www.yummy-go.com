"use client";

import { CalendarDays, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportBranchOption } from "../shared/report-branch-options";
import type { DailyClosingReportFilters } from "./daily-closing-report-types";

interface DailyClosingReportControlsProps {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportBranchOption[];
  canApply: boolean;
  disabled: boolean;
  draftFilters: DailyClosingReportFilters;
  onApply: () => void;
  onDraftChange: (filters: DailyClosingReportFilters) => void;
}

export function DailyClosingReportControls({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  disabled,
  draftFilters,
  onApply,
  onDraftChange,
}: DailyClosingReportControlsProps) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{t("report.dailyClosing.closingContext")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("report.dailyClosing.closingContextDescription")}
          </p>
        </div>
        <CalendarDays aria-hidden="true" className="shrink-0 text-primary" />
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onApply();
          }}
        >
          <FieldGroup className="grid gap-3 md:grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1fr)_auto] md:items-end">
            <Field className="gap-1.5" data-disabled={branchLocked || disabled}>
              <FieldLabel htmlFor="daily-closing-branch">{t("fields.branch_uuid_fk")}</FieldLabel>
              <Select
                value={draftFilters.branchUuid}
                disabled={branchLocked || branchLoading || disabled}
                onValueChange={(branchUuid) =>
                  onDraftChange({ ...draftFilters, branchUuid })
                }
              >
                <SelectTrigger id="daily-closing-branch" className="w-full">
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
              <Input
                id="daily-closing-date"
                type="date"
                value={draftFilters.date}
                disabled={disabled}
                onChange={(event) =>
                  onDraftChange({ ...draftFilters, date: event.target.value })
                }
              />
            </Field>

            <Button type="submit" disabled={!canApply || disabled}>
              <Search data-icon="inline-start" aria-hidden="true" />
              {t("report.apply")}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
