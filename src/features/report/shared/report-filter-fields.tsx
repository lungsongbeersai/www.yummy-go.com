"use client";

import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { PaymentMethodReportFilter } from "@/config/report-filters";
import type { PageLimit } from "@/services/shared/types";
import { ReportDateInput } from "./report-date-input";

export interface ReportFieldOption {
  label: string;
  value: string;
}

// ค่าเริ่มต้นของทุกช่องคือความสูงมาตรฐานของ Select/Button (h-7) ให้ตรงกันทุกหน้า
// บางรายงาน (daily-closing, best-selling-products, payment-methods) ตั้งใจใช้สเกล h-10
// ทั้งฟอร์มแทน จึงยังรับ triggerClassName/inputClassName จากผู้เรียกไว้ให้ override ได้
interface ReportSelectFieldProps {
  disabled?: boolean;
  fieldClassName?: string;
  id: string;
  label: string;
  options: ReportFieldOption[];
  placeholder?: string;
  triggerClassName?: string;
  value: string;
  onValueChange: (value: string) => void;
}

export function ReportSelectField({
  disabled,
  fieldClassName,
  id,
  label,
  options,
  placeholder,
  triggerClassName,
  value,
  onValueChange,
}: ReportSelectFieldProps) {
  return (
    <Field className={fieldClassName ?? "gap-1.5"}>
      <FieldLabel htmlFor={id} className="text-xs font-bold text-muted-foreground">
        {label}
      </FieldLabel>
      <Select value={value} disabled={disabled} onValueChange={onValueChange}>
        <SelectTrigger id={id} className={triggerClassName ?? "w-full"}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function ReportBranchField({
  branchLoading,
  branchLocked,
  fieldClassName,
  id,
  options,
  triggerClassName,
  value,
  onValueChange,
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  fieldClassName?: string;
  id: string;
  options: ReportFieldOption[];
  triggerClassName?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <ReportSelectField
      disabled={branchLoading || branchLocked || options.length <= 1}
      fieldClassName={fieldClassName}
      id={id}
      label={t("nav.branch")}
      options={options}
      placeholder={t("nav.branch")}
      triggerClassName={triggerClassName}
      value={value}
      onValueChange={onValueChange}
    />
  );
}

interface ReportDateFieldProps {
  disabled?: boolean;
  fieldClassName?: string;
  id: string;
  inputClassName?: string;
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
}

export function ReportDateField({
  disabled,
  fieldClassName,
  id,
  inputClassName,
  label,
  name,
  value,
  onChange,
}: ReportDateFieldProps) {
  return (
    <Field className={fieldClassName ?? "gap-1.5"} data-disabled={disabled}>
      <FieldLabel htmlFor={id} className="text-xs font-bold text-muted-foreground">
        {label}
      </FieldLabel>
      <ReportDateInput
        id={id}
        name={name}
        label={label}
        value={value}
        autoComplete={name ? "off" : undefined}
        className={inputClassName}
        disabled={disabled}
        onValueChange={onChange}
      />
    </Field>
  );
}

// ช่องช่วงวันที่ (from/to) — payment-methods/best-selling ใส่ name+autoComplete="off" กันเบราว์เซอร์
// จำค่าฟอร์มเก่า ส่วน category-sales ไม่ได้ใส่ (withNativeName ควบคุมพฤติกรรมนี้ให้ตรงของเดิม)
export function ReportDateRangeFields({
  dateFrom,
  dateTo,
  disabled,
  fieldClassName,
  idPrefix,
  inputClassName,
  withNativeName = false,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom: string;
  dateTo: string;
  disabled?: boolean;
  fieldClassName?: string;
  idPrefix: string;
  inputClassName?: string;
  withNativeName?: boolean;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <ReportDateField
        disabled={disabled}
        fieldClassName={fieldClassName}
        id={`${idPrefix}-date-from`}
        inputClassName={inputClassName}
        label={t("report.filters.dateFrom")}
        name={withNativeName ? `${idPrefix}-date-from` : undefined}
        value={dateFrom}
        onChange={onDateFromChange}
      />
      <ReportDateField
        disabled={disabled}
        fieldClassName={fieldClassName}
        id={`${idPrefix}-date-to`}
        inputClassName={inputClassName}
        label={t("report.filters.dateTo")}
        name={withNativeName ? `${idPrefix}-date-to` : undefined}
        value={dateTo}
        onChange={onDateToChange}
      />
    </>
  );
}

export function ReportPageLimitField({
  fieldClassName,
  id,
  triggerClassName,
  value,
  onValueChange,
}: {
  fieldClassName?: string;
  id: string;
  triggerClassName?: string;
  value: PageLimit;
  onValueChange: (value: PageLimit) => void;
}) {
  const { t } = useTranslation();

  return (
    <ReportSelectField
      fieldClassName={fieldClassName}
      id={id}
      label={t("common.rowsPerPage")}
      options={PAGE_LIMIT_OPTIONS.map((limit) => ({
        label: limit === "All" ? t("common.all") : String(limit),
        value: String(limit),
      }))}
      triggerClassName={triggerClassName}
      value={String(value)}
      onValueChange={(next) => onValueChange(next === "All" ? "All" : Number(next))}
    />
  );
}

export function ReportPaymentMethodField({
  fieldClassName,
  id,
  options,
  triggerClassName,
  value,
  onValueChange,
}: {
  fieldClassName?: string;
  id: string;
  options: { label: string; value: PaymentMethodReportFilter }[];
  triggerClassName?: string;
  value: PaymentMethodReportFilter;
  onValueChange: (value: PaymentMethodReportFilter) => void;
}) {
  const { t } = useTranslation();

  return (
    <ReportSelectField
      fieldClassName={fieldClassName}
      id={id}
      label={t("report.filters.paymentMethod")}
      options={options}
      triggerClassName={triggerClassName}
      value={value}
      onValueChange={(next) => onValueChange(next as PaymentMethodReportFilter)}
    />
  );
}
