import type { ReactNode } from "react";
import { DateFilterButton } from "@/components/common/date-filter-button";
import { SearchInput } from "@/components/common/search-input";
import { cn } from "@/lib/utils";

interface FilterHeaderSearchConfig {
  ariaLabel: string;
  disabled?: boolean;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

interface FilterHeaderDateRangeConfig {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

interface FilterHeaderToolbarProps {
  className?: string;
  dateRange?: FilterHeaderDateRangeConfig;
  extraChips?: ReactNode;
  filterControl?: ReactNode;
  refreshControl?: ReactNode;
  search?: FilterHeaderSearchConfig;
  summaryControl?: ReactNode;
}

export function FilterHeaderToolbar({
  className,
  dateRange,
  extraChips,
  filterControl,
  refreshControl,
  search,
  summaryControl,
}: FilterHeaderToolbarProps) {
  return (
    <div className={cn("shrink-0 rounded-lg border border-border bg-card px-3 py-2 shadow-sm", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {search ? (
          <SearchInput
            ariaLabel={search.ariaLabel}
            className="min-w-44 flex-1 h-11 sm:h-9"
            disabled={search.disabled}
            name="filterSearch"
            placeholder={search.placeholder}
            value={search.value}
            onChange={search.onChange}
          />
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {dateRange ? (
              <DateFilterButton
                ariaLabel={dateRange.ariaLabel}
                className={cn("h-9 max-w-full rounded-md", dateRange.className)}
                disabled={dateRange.disabled}
                label={dateRange.label}
                onClick={dateRange.onClick}
              />
            ) : null}
            {extraChips}
          </div>
        )}

        {search && dateRange ? (
          <DateFilterButton
            ariaLabel={dateRange.ariaLabel}
            className={cn("hidden h-9 max-w-72 shrink-0 rounded-md md:inline-flex", dateRange.className)}
            disabled={dateRange.disabled}
            label={dateRange.label}
            onClick={dateRange.onClick}
          />
        ) : null}

        {filterControl}
        {summaryControl}
        {refreshControl}
      </div>
    </div>
  );
}
