"use client";

import { useTranslation } from "react-i18next";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldTitle
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem
} from "@/components/ui/toggle-group";
import type { StockStatus } from "@/services/stock";
import { STOCK_PAGE_LIMIT_OPTIONS, STOCK_STATUS_OPTIONS } from "./stock-constants";
import { stockStatusTranslationKey } from "./stock-utils";

interface StockCategoryOption {
  label: string;
  value: string;
}

interface StockFiltersProps {
  category: string;
  categoryDisabled: boolean;
  categoryOptions: StockCategoryOption[];
  disabled: boolean;
  limit: number;
  status: StockStatus;
  onCategoryChange: (value: string) => void;
  onLimitChange: (value: number) => void;
  onStatusChange: (value: StockStatus) => void;
}

export function StockFilters({
  category,
  categoryDisabled,
  categoryOptions,
  disabled,
  limit,
  status,
  onCategoryChange,
  onLimitChange,
  onStatusChange
}: StockFiltersProps) {
  const { t } = useTranslation();

  return (
    <FieldGroup className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(12rem,18rem)_minmax(7rem,9rem)_minmax(0,1fr)] lg:items-end">
      <Field className="col-span-2 gap-1 lg:hidden" data-disabled={disabled || undefined}>
        <FieldLabel htmlFor="stock-status-filter-mobile">
          {t("stock.filters.status")}
        </FieldLabel>
        <StatusSelect
          id="stock-status-filter-mobile"
          disabled={disabled}
          status={status}
          onStatusChange={onStatusChange}
        />
      </Field>

      <Field className="gap-1" data-disabled={categoryDisabled || undefined}>
        <FieldLabel htmlFor="stock-category-filter">
          {t("stock.filters.category")}
        </FieldLabel>
        <Select
          value={category}
          disabled={categoryDisabled}
          onValueChange={onCategoryChange}
        >
          <SelectTrigger id="stock-category-filter" className="h-11 w-full bg-background lg:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectGroup>
              <SelectItem value="all">
                {t("stock.filters.allCategories")}
              </SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field className="gap-1" data-disabled={disabled || undefined}>
        <FieldLabel htmlFor="stock-limit-filter">
          {t("stock.filters.rows")}
        </FieldLabel>
        <Select
          value={String(limit)}
          disabled={disabled}
          onValueChange={(value) => onLimitChange(Number(value))}
        >
          <SelectTrigger id="stock-limit-filter" className="h-11 w-full bg-background lg:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
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

      <Field className="hidden gap-1 lg:flex" data-disabled={disabled || undefined}>
        <FieldTitle id="stock-status-filter-label">
          {t("stock.filters.status")}
        </FieldTitle>
        <ToggleGroup
          type="single"
          variant="outline"
          value={status}
          disabled={disabled}
          aria-labelledby="stock-status-filter-label"
          className="w-full"
          onValueChange={(value) => {
            if (value) onStatusChange(value as StockStatus);
          }}
        >
          {STOCK_STATUS_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              className="min-w-0 flex-1 px-2"
            >
              <span className="truncate">
                {t(stockStatusTranslationKey(option))}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
    </FieldGroup>
  );
}

function StatusSelect({
  disabled,
  id,
  status,
  onStatusChange
}: {
  disabled: boolean;
  id: string;
  status: StockStatus;
  onStatusChange: (value: StockStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <Select
      value={status}
      disabled={disabled}
      onValueChange={(value) => onStatusChange(value as StockStatus)}
    >
      <SelectTrigger id={id} className="h-11 w-full bg-background lg:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectGroup>
          {STOCK_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(stockStatusTranslationKey(option))}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
