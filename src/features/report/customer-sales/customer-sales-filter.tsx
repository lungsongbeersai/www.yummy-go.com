"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import { SearchInput } from "@/components/common/search-input";
import {
  ReportBranchField,
  ReportDateRangeFields,
  ReportSelectField,
  type ReportFieldOption,
} from "@/features/report/shared/report-filter-fields";
import { ReportFilterCard, ReportFilterSheet } from "@/features/report/shared/report-filter-shell";
import { reportOrderOptions } from "@/features/report/shared/report-sort-utils";
import type { Customer } from "@/services/customer";
import { CustomerSalesCombobox } from "./customer-sales-combobox";

export interface CustomerSalesDraft {
  branchUuid: string;
  customerUuid: string;
  customerLabel: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  orderBy: "ASC" | "DESC";
}

interface FieldsProps {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportFieldOption[];
  draft: CustomerSalesDraft;
  draftBranch: string;
  language: string;
  onDraftChange: (updater: (previous: CustomerSalesDraft) => CustomerSalesDraft) => void;
}

function selectCustomer(customer: Customer | null, previous: CustomerSalesDraft): CustomerSalesDraft {
  if (!customer) return { ...previous, customerUuid: "", customerLabel: "" };
  return { ...previous, customerUuid: customer.customer_uuid, customerLabel: customer.customer_name || customer.member_code || customer.customer_uuid };
}

function CustomerSalesFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draft,
  draftBranch,
  idPrefix,
  language,
  onDraftChange,
}: FieldsProps & { idPrefix: string }) {
  const { t } = useTranslation();

  return (
    <>
      <ReportBranchField
        id={`${idPrefix}-branch`}
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        options={branchOptions}
        value={draftBranch}
        onValueChange={branchUuid => onDraftChange(previous => ({ ...previous, branchUuid }))}
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-muted-foreground" htmlFor={`${idPrefix}-customer`}>
          {t("report.customerSales.customer")}
        </label>
        <CustomerSalesCombobox
          id={`${idPrefix}-customer`}
          label={draft.customerLabel}
          language={language}
          value={draft.customerUuid}
          onSelect={customer => onDraftChange(previous => selectCustomer(customer, previous))}
        />
      </div>
      <ReportDateRangeFields
        idPrefix={idPrefix}
        dateFrom={draft.dateFrom}
        dateTo={draft.dateTo}
        onDateFromChange={dateFrom => onDraftChange(previous => ({ ...previous, dateFrom }))}
        onDateToChange={dateTo => onDraftChange(previous => ({ ...previous, dateTo }))}
      />
      <Field className="min-w-0 gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-search`} className="text-xs font-bold text-muted-foreground">
          {t("actions.search")}
        </FieldLabel>
        <SearchInput
          id={`${idPrefix}-search`}
          ariaLabel={t("actions.search")}
          placeholder={t("report.customerSales.searchPlaceholder")}
          value={draft.search}
          onChange={search => onDraftChange(previous => ({ ...previous, search }))}
        />
      </Field>
      <ReportSelectField
        id={`${idPrefix}-order-by`}
        label={t("report.filters.orderBy")}
        options={reportOrderOptions(t)}
        value={draft.orderBy}
        onValueChange={orderBy => onDraftChange(previous => ({ ...previous, orderBy: orderBy as "ASC" | "DESC" }))}
      />
    </>
  );
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับ category-sales/payment-methods
export function CustomerSalesFilterBar({
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
      className="hidden shrink-0 rounded-none border-x-0 border-t-0 shadow-none lg:block"
      contentClassName="grid min-w-0 items-end gap-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
      loading={loading}
      onApply={onApply}
    >
      <CustomerSalesFilterFields idPrefix="customer-sales" {...fieldProps} />
    </ReportFilterCard>
  );
}

// จอเล็ก: modal เดียวกับรายงานอื่น (ReportFilterSheet)
export function CustomerSalesFilterSheet({
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
      description={t("report.customerSales.title")}
      gridClassName="lg:grid-cols-3"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <CustomerSalesFilterFields idPrefix="customer-sales-mobile" {...fieldProps} />
      {dateRangeInvalid ? (
        <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3" role="alert">
          {t("report.customerSales.invalidDateRange")}
        </p>
      ) : null}
    </ReportFilterSheet>
  );
}
