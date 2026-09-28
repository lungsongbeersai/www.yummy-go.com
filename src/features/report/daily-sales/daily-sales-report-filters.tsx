"use client";

import type { ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_LIMIT_OPTIONS, isAllPageLimit } from "@/lib/pagination";
import { reportOrderLabel, reportOrderOptions } from "../shared/report-sort-utils";
import { ReportDateInput } from "../shared/report-date-input";
import { ReportFilterCard, ReportFilterSheet } from "../shared/report-filter-shell";
import { ReportLocationFields } from "../shared/report-location-fields";
import type { ReportLocationOptions } from "../shared/report-location";
import type {
  DetailPaginationBasis,
  ReportBranchOption,
  ReportFilters,
} from "./daily-sales-report-types";
import {
  paymentMethodLabel,
  paymentMethodOptions,
} from "./daily-sales-report-utils";

// เงื่อนไข "ไม่ใช่ค่าเริ่มต้น" ของฟิลด์รอง — ใช้ตัดสินว่าจะโชว์ badge บอกจำนวนตัวกรองที่ซ่อนอยู่ใน popover หรือไม่
// (limit เทียบกับตัวเลือกแรกของ PAGE_LIMIT_OPTIONS เป็นค่าประมาณ ไม่ใช่ default ที่แท้จริงของทุกหน้า
// แต่พอใช้เป็นสัญญาณคร่าวๆ ว่าผู้ใช้ปรับค่าจากที่ตั้งไว้แต่แรกหรือยัง)
function secondaryFilterCount(filters: ReportFilters) {
  let count = 0;
  if (String(filters.limit) !== String(PAGE_LIMIT_OPTIONS[0])) count += 1;
  if (filters.paymentMethod !== "All") count += 1;
  if (filters.orderBy !== "DESC") count += 1;
  if (filters.zoneUuid !== "all") count += 1;
  if (filters.tableUuid !== "all") count += 1;
  return count;
}

type ReportFilterProps = {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportBranchOption[];
  canApply: boolean;
  detailPaginationBasis: DetailPaginationBasis;
  draftFilters: ReportFilters;
  loading: boolean;
  locationOptions: ReportLocationOptions & { loading: boolean };
  onApply: () => void;
  onDraftChange: (filters: ReportFilters) => void;
};

// จอ lg ขึ้นไปมีที่ว่างพอให้ตัวกรองอยู่บนหน้าเลย ไม่ต้องเปิด modal เพื่อเปลี่ยนแค่สาขา
// (ก่อนหน้านี้คอมโพเนนต์นี้ถูกเขียนไว้แต่ไม่มีใครเรียก ทุกขนาดจอจึงถูกบังคับให้ใช้ modal)
// เดิมมี 7 ฟิลด์วางเรียงกันหมด กว้างพอจะไม่ตกบรรทัดแค่จอ 2xl (1536px+) — จอทำงานทั่วไป (lg-2xl)
// เห็นตัวกรองตกเป็น 2 แถวจนดูอึดอัด จึงเหลือแค่ฟิลด์ที่ใช้บ่อย (ค้นหา/สาขา/ช่วงวันที่) ไว้แถวเดียว
// ฟิลด์รอง (วิธีชำระ/เรียงลำดับ/จำนวนต่อหน้า) ย้ายเข้า popover "ตัวกรองเพิ่มเติม" แบบเดียวกับ sales-list
export function DailySalesFilterBar({
  actions,
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  detailPaginationBasis,
  draftFilters,
  loading,
  locationOptions,
  onApply,
  onDraftChange,
}: ReportFilterProps & { actions?: ReactNode }) {
  const { t } = useTranslation();
  const secondaryCount = secondaryFilterCount(draftFilters);

  return (
    <ReportFilterCard
      actions={actions}
      canApply={canApply}
      // shrink-0: Card มี overflow-hidden ซึ่งทำให้ min-height ของ flex item เป็น 0 — ไม่ใส่ไว้ พอตาราง/skeleton
      // กินความสูงเต็ม การ์ดตัวกรองจะถูกบีบจนช่องกรอกโดนตัดครึ่ง (เห็นตอนโหลด/รีเฟรช)
      className="hidden shrink-0 shadow-none lg:block"
      contentClassName="flex flex-wrap items-end gap-3 py-4"
      loading={loading}
      onApply={onApply}
    >
      <DailySalesPrimaryFields
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        branchOptions={branchOptions}
        draftFilters={draftFilters}
        idPrefix="report"
        onDraftChange={onDraftChange}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline">
            <SlidersHorizontal data-icon="inline-start" />
            {t("report.filters.moreFilters")}
            {secondaryCount ? (
              <Badge>
                {secondaryCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <PopoverTitle>{t("report.filters.moreFilters")}</PopoverTitle>
          <div className="grid gap-3">
            <DailySalesSecondaryFields
              detailPaginationBasis={detailPaginationBasis}
              draftFilters={draftFilters}
              idPrefix="report"
              locationOptions={locationOptions}
              onDraftChange={onDraftChange}
            />
          </div>
        </PopoverContent>
      </Popover>
    </ReportFilterCard>
  );
}

export function DailySalesFilterSheet({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  detailPaginationBasis,
  draftFilters,
  loading,
  locationOptions,
  open,
  onApply,
  onDraftChange,
  onOpenChange,
}: ReportFilterProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ReportFilterSheet
      canApply={canApply}
      description={t("report.dailySalesTitle")}
      gridClassName="lg:grid-cols-3"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <DailySalesPrimaryFields
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        branchOptions={branchOptions}
        draftFilters={draftFilters}
        idPrefix="report-mobile"
        onDraftChange={onDraftChange}
      />
      <DailySalesSecondaryFields
        detailPaginationBasis={detailPaginationBasis}
        draftFilters={draftFilters}
        idPrefix="report-mobile"
        locationOptions={locationOptions}
        onDraftChange={onDraftChange}
      />
    </ReportFilterSheet>
  );
}

// จอเล็กยังต้องใช้ modal แต่ต้องอ่านออกได้ว่า "ตอนนี้กรองอะไรอยู่" โดยไม่ต้องเปิดเข้าไปดู
// เดิมมีคอมโพเนนต์ทำหน้าที่นี้อยู่แล้วแต่ไม่มีใครเรียก และยังซ้ำกับ FilterHeaderToolbar
// (ปุ่มวันที่/ปุ่มเปิดตัวกรอง) จึงเหลือไว้แค่ส่วนที่ให้ข้อมูลจริงคือแถว badge
export function AppliedFilterBadges({
  branchLabel,
  detailPaginationBasis,
  filters,
  locationOptions,
}: {
  branchLabel: string;
  detailPaginationBasis: DetailPaginationBasis;
  filters: ReportFilters;
  locationOptions: ReportLocationOptions;
}) {
  const { t } = useTranslation();
  const limitCount = isAllPageLimit(filters.limit) ? t("common.all") : filters.limit;
  const limitLabel =
    filters.typePage === "detail"
      ? detailPaginationBasis === "bills"
        ? t("report.billsPerPageValue", { count: limitCount })
        : t("report.linesPerPageValue", { count: limitCount })
      : t("report.rowsPerPageValue", { count: limitCount });
  const badges = [
    branchLabel,
    filters.zoneUuid === "all"
      ? null
      : locationOptions.zoneOptions.find((option) => option.value === filters.zoneUuid)?.label,
    filters.tableUuid === "all"
      ? null
      : locationOptions.tableOptions.find((option) => option.value === filters.tableUuid)?.label,
    paymentMethodLabel(t, filters.paymentMethod),
    reportOrderLabel(t, filters.orderBy),
    limitLabel,
    filters.search
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((label) => (
        <Badge key={label} variant="secondary">
          {label}
        </Badge>
      ))}
    </div>
  );
}

// ฟิลด์ที่ใช้บ่อยที่สุด — โชว์ตลอดทั้งบนแถบ desktop และ sheet มือถือ
function DailySalesPrimaryFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draftFilters,
  idPrefix,
  onDraftChange,
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportBranchOption[];
  draftFilters: ReportFilters;
  idPrefix: string;
  onDraftChange: (filters: ReportFilters) => void;
}) {
  const { t } = useTranslation();

  function patch(patch: Partial<ReportFilters>) {
    onDraftChange({ ...draftFilters, ...patch });
  }

  return (
    <>
      {/* ค้นหาเป็นตัวกรองปกติ = มีผลตอนกดปุ่ม "ໃຊ້" เหมือนช่องอื่น (เดิมอยู่หัวตารางและกรองทันทีที่พิมพ์) */}
      <Field className="min-w-48 flex-1 sm:col-span-2 lg:col-span-1">
        <FieldLabel htmlFor={`${idPrefix}-search`}>
          {t("actions.search")}
        </FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            id={`${idPrefix}-search`}
            type="search"
            placeholder={t("actions.search")}
            value={draftFilters.search}
            onChange={(event) => patch({ search: event.target.value })}
          />
        </InputGroup>
      </Field>
      <Field className="lg:w-48 lg:flex-none">
        <FieldLabel
          htmlFor={`${idPrefix}-branch`}
         
        >
          {t("nav.branch")}
        </FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLoading || branchLocked || branchOptions.length <= 1}
          onValueChange={(value) => patch({ branchUuid: value, tableUuid: "all", zoneUuid: "all" })}
        >
          <SelectTrigger id={`${idPrefix}-branch`} className="w-full">
            <SelectValue placeholder={t("nav.branch")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {branchOptions.map((branch) => (
                <SelectItem key={branch.value} value={branch.value}>
                  {branch.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="lg:w-36 lg:flex-none">
        <FieldLabel
          htmlFor={`${idPrefix}-date-from`}
         
        >
          {t("report.filters.dateFrom")}
        </FieldLabel>
        <ReportDateInput
          id={`${idPrefix}-date-from`}
          label={t("report.filters.dateFrom")}
          value={draftFilters.dateFrom}
          onValueChange={(dateFrom) => patch({ dateFrom })}
        />
      </Field>
      <Field className="lg:w-36 lg:flex-none">
        <FieldLabel
          htmlFor={`${idPrefix}-date-to`}
         
        >
          {t("report.filters.dateTo")}
        </FieldLabel>
        <ReportDateInput
          id={`${idPrefix}-date-to`}
          label={t("report.filters.dateTo")}
          value={draftFilters.dateTo}
          onValueChange={(dateTo) => patch({ dateTo })}
        />
      </Field>
    </>
  );
}

// ฟิลด์ที่ใช้น้อยกว่า — desktop ซ่อนไว้ใน popover "ตัวกรองเพิ่มเติม", มือถือต่อท้ายฟิลด์หลักใน sheet เดิม
function DailySalesSecondaryFields({
  detailPaginationBasis,
  draftFilters,
  idPrefix,
  locationOptions,
  onDraftChange,
}: {
  detailPaginationBasis: DetailPaginationBasis;
  draftFilters: ReportFilters;
  idPrefix: string;
  locationOptions: ReportLocationOptions & { loading: boolean };
  onDraftChange: (filters: ReportFilters) => void;
}) {
  const { t } = useTranslation();

  function patch(patch: Partial<ReportFilters>) {
    onDraftChange({ ...draftFilters, ...patch });
  }

  return (
    <>
      <ReportLocationFields
        branchUuid={draftFilters.branchUuid}
        idPrefix={idPrefix}
        loading={locationOptions.loading}
        tableOptions={locationOptions.tableOptions}
        tableUuid={draftFilters.tableUuid}
        zoneOptions={locationOptions.zoneOptions}
        zoneUuid={draftFilters.zoneUuid}
        onTableChange={(tableUuid) => patch({ tableUuid })}
        onZoneChange={(zoneUuid) => patch({ tableUuid: "all", zoneUuid })}
      />
      <Field>
        <FieldLabel
          htmlFor={`${idPrefix}-payment-method`}
         
        >
          {t("report.filters.paymentMethod")}
        </FieldLabel>
        <Select
          value={draftFilters.paymentMethod}
          onValueChange={(value) =>
            patch({ paymentMethod: value as ReportFilters["paymentMethod"] })
          }
        >
          <SelectTrigger id={`${idPrefix}-payment-method`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {paymentMethodOptions.map((method) => (
                <SelectItem key={method} value={method}>
                  {paymentMethodLabel(t, method)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel
          htmlFor={`${idPrefix}-order-by`}
         
        >
          {t("report.filters.orderBy")}
        </FieldLabel>
        <Select
          value={draftFilters.orderBy}
          onValueChange={(value) =>
            patch({ orderBy: value as ReportFilters["orderBy"] })
          }
        >
          <SelectTrigger id={`${idPrefix}-order-by`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {reportOrderOptions(t).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel
          htmlFor={`${idPrefix}-limit`}
         
        >
          {draftFilters.typePage === "detail"
            ? detailPaginationBasis === "bills"
              ? t("report.billsPerPage")
              : t("report.linesPerPage")
            : t("common.rowsPerPage")}
        </FieldLabel>
        <Select
          value={String(draftFilters.limit)}
          onValueChange={(value) =>
            patch({ limit: value === "All" ? "All" : Number(value) })
          }
        >
          <SelectTrigger id={`${idPrefix}-limit`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PAGE_LIMIT_OPTIONS.map((limit) => (
                <SelectItem key={String(limit)} value={String(limit)}>
                  {limit === "All" ? t("common.all") : limit}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}
