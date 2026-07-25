"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

export interface ReportFieldOption {
  label: string;
  value: string;
}

// ทุกช่องกรอกของฟอร์มตัวกรองรายงาน "ความกว้าง/ความสูง" ต่างกันตาม grid ของแต่ละรายงาน
// (บางหน้าใช้ h-10 rounded-md ชัดเจน บางหน้าใช้ความสูงมาตรฐานของ Select) จึงรับ className
// ของ Field/Trigger มาจากผู้เรียกเสมอ แทนที่จะเดางเดียวให้ทุกหน้า
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
  fieldClassName?: string;
  id: string;
  inputClassName?: string;
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
}

export function ReportDateField({
  fieldClassName,
  id,
  inputClassName,
  label,
  name,
  value,
  onChange,
}: ReportDateFieldProps) {
  return (
    <Field className={fieldClassName ?? "gap-1.5"}>
      <FieldLabel htmlFor={id} className="text-xs font-bold text-muted-foreground">
        {label}
      </FieldLabel>
      <Input
        id={id}
        name={name}
        type="date"
        value={value}
        autoComplete={name ? "off" : undefined}
        className={inputClassName}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

// ช่องช่วงวันที่ (from/to) — payment-methods/best-selling ใส่ name+autoComplete="off" กันเบราว์เซอร์
// จำค่าฟอร์มเก่า ส่วน category-sales ไม่ได้ใส่ (withNativeName ควบคุมพฤติกรรมนี้ให้ตรงของเดิม)
export function ReportDateRangeFields({
  dateFrom,
  dateTo,
  fieldClassName,
  idPrefix,
  inputClassName,
  withNativeName = false,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom: string;
  dateTo: string;
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
        fieldClassName={fieldClassName}
        id={`${idPrefix}-date-from`}
        inputClassName={inputClassName}
        label={t("report.filters.dateFrom")}
        name={withNativeName ? `${idPrefix}-date-from` : undefined}
        value={dateFrom}
        onChange={onDateFromChange}
      />
      <ReportDateField
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

// สาขา + ช่วงวันที่ + จำนวนแถว คือฟิลด์ที่ทั้ง 3 รายงานมีเหมือนกันทุกตัวรวมถึงคลาสจัดวาง
// ฟิลด์เฉพาะรายงาน (วิธีชำระ, กลุ่มสินค้า) ส่งเป็น children มาแทรกก่อนช่องจำนวนแถว
export function ReportBaseFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  branchUuid,
  children,
  dateFrom,
  dateTo,
  idPrefix,
  limit,
  onBranchChange,
  onDateFromChange,
  onDateToChange,
  onLimitChange
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportFieldOption[];
  branchUuid: string;
  children?: ReactNode;
  dateFrom: string;
  dateTo: string;
  idPrefix: string;
  limit: PageLimit;
  onBranchChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onLimitChange: (value: PageLimit) => void;
}) {
  return (
    <>
      <ReportBranchField
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        fieldClassName="min-w-0 gap-1.5 sm:col-span-2 lg:col-span-4"
        id={`${idPrefix}-branch`}
        options={branchOptions}
        triggerClassName="h-10 w-full rounded-md"
        value={branchUuid}
        onValueChange={onBranchChange}
      />
      <ReportDateRangeFields
        dateFrom={dateFrom}
        dateTo={dateTo}
        fieldClassName="min-w-0 gap-1.5 lg:col-span-4"
        idPrefix={idPrefix}
        inputClassName="h-10 rounded-md text-sm"
        withNativeName
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
      />
      {children}
      <ReportPageLimitField
        fieldClassName="min-w-0 gap-1.5 lg:col-span-6"
        id={`${idPrefix}-limit`}
        triggerClassName="h-10 w-full rounded-md"
        value={limit}
        onValueChange={onLimitChange}
      />
    </>
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
