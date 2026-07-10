import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { DateFilterButton } from "@/components/common/date-filter-button";
import { Input } from "@/components/ui/input";
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
          <div className="relative min-w-44 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={search.ariaLabel}
              autoComplete="off"
              className="h-11 pl-9 sm:h-9"
              disabled={search.disabled}
              name="filterSearch"
              placeholder={search.placeholder}
              spellCheck={false}
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
            />
          </div>
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
