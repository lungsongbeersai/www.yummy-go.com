"use client";

import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StockStatus } from "@/services/stock";
import { STOCK_PAGE_LIMIT_OPTIONS, STOCK_STATUS_OPTIONS } from "./stock-constants";
import { stockStatusTranslationKey } from "./stock-utils";

interface StockSelectOption {
  label: string;
  value: string;
}

// สถานะมีแค่ 4 ค่าและเป็นตัวกรองที่ใช้บ่อยสุด — ใช้ Tabs เห็นครบทุกค่าและกดครั้งเดียว ทุกขนาดจอ
export function StockStatusTabs({
  disabled,
  status,
  onStatusChange
}: {
  disabled: boolean;
  status: StockStatus;
  onStatusChange: (value: StockStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <Tabs
      value={status}
      onValueChange={(value) => {
        if (value) onStatusChange(value as StockStatus);
      }}
    >
      <TabsList aria-label={t("stock.filters.status")}>
        {STOCK_STATUS_OPTIONS.map((option) => (
          <TabsTrigger key={option} value={option} disabled={disabled}>
            {t(stockStatusTranslationKey(option))}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function StockFilters({
  branch,
  branchDisabled,
  branchOptions,
  category,
  categoryDisabled,
  categoryOptions,
  onBranchChange,
  onCategoryChange
}: {
  branch: string;
  branchDisabled: boolean;
  branchOptions: StockSelectOption[];
  category: string;
  categoryDisabled: boolean;
  categoryOptions: StockSelectOption[];
  onBranchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Select value={branch} disabled={branchDisabled} onValueChange={onBranchChange}>
        <SelectTrigger aria-label={t("stock.filters.branch")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {branchOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={category} disabled={categoryDisabled} onValueChange={onCategoryChange}>
        <SelectTrigger aria-label={t("stock.filters.category")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            <SelectItem value="all">{t("stock.filters.allCategories")}</SelectItem>
            {categoryOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}

export function StockLimitSelect({
  disabled,
  limit,
  onLimitChange
}: {
  disabled: boolean;
  limit: number;
  onLimitChange: (value: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <Field orientation="horizontal" className="w-auto" data-disabled={disabled || undefined}>
      <FieldLabel htmlFor="stock-limit-filter">{t("stock.filters.rows")}</FieldLabel>
      <Select value={String(limit)} disabled={disabled} onValueChange={(value) => onLimitChange(Number(value))}>
        <SelectTrigger id="stock-limit-filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {STOCK_PAGE_LIMIT_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
