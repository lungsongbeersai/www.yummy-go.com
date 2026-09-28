"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  ReportBranchField,
  ReportDateRangeFields,
  ReportSelectField,
  type ReportFieldOption,
} from "@/features/report/shared/report-filter-fields";
import { ReportFilterCard, ReportFilterSheet } from "@/features/report/shared/report-filter-shell";

export interface OrderAuditDraft {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  action: string;
  entity: string;
}

interface FieldsProps {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportFieldOption[];
  actionOptions: ReportFieldOption[];
  entityOptions: ReportFieldOption[];
  draft: OrderAuditDraft;
  draftBranch: string;
  onDraftChange: (updater: (previous: OrderAuditDraft) => OrderAuditDraft) => void;
}

// ค่าค้นหาเป็นตัวกรองปกติ = มีผลตอนกด "ໃຊ້" เหมือนช่องอื่น (เดิมอยู่ toolbar หัวหน้าและกรองทันทีที่กด enter)
function OrderAuditFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  actionOptions,
  entityOptions,
  draft,
  draftBranch,
  idPrefix,
  onDraftChange,
}: FieldsProps & { idPrefix: string }) {
  const { t } = useTranslation();

  return (
    <>
      <Field className="sm:col-span-2 lg:col-span-1">
        <FieldLabel htmlFor={`${idPrefix}-search`}>{t("orderAudit.search")}</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            id={`${idPrefix}-search`}
            type="search"
            placeholder={t("orderAudit.search")}
            value={draft.search}
            onChange={event => {
              const search = event.target.value;
              onDraftChange(previous => ({ ...previous, search }));
            }}
          />
        </InputGroup>
      </Field>
      <ReportBranchField
        id={`${idPrefix}-branch`}
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        options={branchOptions}
        value={draftBranch}
        onValueChange={branchUuid => onDraftChange(previous => ({ ...previous, branchUuid }))}
      />
      <ReportDateRangeFields
        idPrefix={idPrefix}
        dateFrom={draft.dateFrom}
        dateTo={draft.dateTo}
        onDateFromChange={dateFrom => onDraftChange(previous => ({ ...previous, dateFrom }))}
        onDateToChange={dateTo => onDraftChange(previous => ({ ...previous, dateTo }))}
      />
      <ReportSelectField
        id={`${idPrefix}-action`}
        label={t("orderAudit.action")}
        value={draft.action}
        options={actionOptions}
        onValueChange={action => onDraftChange(previous => ({ ...previous, action }))}
      />
      <ReportSelectField
        id={`${idPrefix}-entity`}
        label={t("orderAudit.entity")}
        value={draft.entity}
        options={entityOptions}
        onValueChange={entity => onDraftChange(previous => ({ ...previous, entity }))}
      />
    </>
  );
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับ category-sales/payment-methods
export function OrderAuditFilterBar({
  actions,
  canApply,
  loading,
  onApply,
  ...fieldProps
}: FieldsProps & { actions?: ReactNode; canApply: boolean; loading: boolean; onApply: () => void }) {
  return (
    <ReportFilterCard
      actions={actions}
      canApply={canApply}
      // shrink-0: Card มี overflow-hidden (min-height ของ flex item = 0) — กันถูกบีบ ดู report-layout.tsx
      className="hidden shrink-0 shadow-none lg:block"
      contentClassName="grid items-end gap-3 py-4 lg:grid-cols-3 2xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]"
      loading={loading}
      onApply={onApply}
    >
      <OrderAuditFilterFields idPrefix="order-audit" {...fieldProps} />
    </ReportFilterCard>
  );
}

// จอเล็ก: modal เดียวกับรายงานอื่น (ReportFilterSheet) แทน Sheet เดิมที่ใช้ทุกขนาดจอ
export function OrderAuditFilterSheet({
  canApply,
  dateRangeInvalid,
  loading,
  open,
  onApply,
  onOpenChange,
  ...fieldProps
}: FieldsProps & {
  canApply: boolean;
  dateRangeInvalid: boolean;
  loading: boolean;
  open: boolean;
  onApply: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ReportFilterSheet
      canApply={canApply}
      description={t("orderAudit.title")}
      gridClassName="lg:grid-cols-3"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <OrderAuditFilterFields idPrefix="order-audit-mobile" {...fieldProps} />
      {dateRangeInvalid ? (
        <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3" role="alert">
          {t("orderAudit.invalidDates")}
        </p>
      ) : null}
    </ReportFilterSheet>
  );
}
