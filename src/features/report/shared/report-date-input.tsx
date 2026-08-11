"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";

type DateParts = {
  day: number;
  month: number;
  year: number;
};

interface ReportDateInputProps {
  autoComplete?: string;
  className?: string;
  disabled?: boolean;
  id: string;
  label: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export function reportDateParts(value: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (
      year >= 1970 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= daysInMonth(year, month)
    ) {
      return { day, month, year };
    }
  }

  const [year, month, day] = localDateInputValue().split("-").map(Number);
  return { day, month, year };
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function reportDateValue({ day, month, year }: DateParts) {
  return `${year}-${twoDigits(month)}-${twoDigits(day)}`;
}

export function reportDateDisplayValue(value: string) {
  const { day, month, year } = reportDateParts(value);
  return `${twoDigits(day)}/${twoDigits(month)}/${year}`;
}

export function ReportDateInput({
  autoComplete,
  className,
  disabled,
  id,
  label,
  name,
  value,
  onValueChange,
}: ReportDateInputProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateParts>(() => reportDateParts(value));
  const dayOptions = useMemo(
    () => Array.from({ length: daysInMonth(draft.year, draft.month) }, (_, index) => index + 1),
    [draft.month, draft.year],
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const lastYear = Math.max(currentYear + 5, draft.year);
    const firstYear = Math.min(1970, draft.year);
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index);
  }, [draft.year]);

  function updateYear(nextYear: number) {
    setDraft((current) => ({
      ...current,
      day: Math.min(current.day, daysInMonth(nextYear, current.month)),
      year: nextYear,
    }));
  }

  function updateMonth(nextMonth: number) {
    setDraft((current) => ({
      ...current,
      day: Math.min(current.day, daysInMonth(current.year, nextMonth)),
      month: nextMonth,
    }));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setDraft(reportDateParts(value));
    setOpen(nextOpen);
  }

  function confirmDate() {
    onValueChange(reportDateValue(draft));
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          className={cn(
            "w-full justify-between bg-background px-3 font-normal tabular-nums",
            className,
          )}
        >
          <span>{reportDateDisplayValue(value)}</span>
          <CalendarDays aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DialogTrigger>

      {name ? <input type="hidden" name={name} value={value} autoComplete={autoComplete} /> : null}

      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription className="sr-only">{label}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <DatePartSelect
            label="DD"
            value={draft.day}
            options={dayOptions}
            onValueChange={(day) => setDraft((current) => ({ ...current, day }))}
          />
          <DatePartSelect
            label="MM"
            value={draft.month}
            options={Array.from({ length: 12 }, (_, index) => index + 1)}
            onValueChange={updateMonth}
          />
          <DatePartSelect
            label="YYYY"
            value={draft.year}
            options={yearOptions}
            onValueChange={updateYear}
          />
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("actions.cancel")}
          </Button>
          <Button type="button" onClick={confirmDate}>
            {t("actions.selectDate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DatePartSelect({
  label,
  options,
  value,
  onValueChange,
}: {
  label: string;
  options: number[];
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <Select value={String(value)} onValueChange={(nextValue) => onValueChange(Number(nextValue))}>
        <SelectTrigger className="h-11 w-full px-2 tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {label === "YYYY" ? option : twoDigits(option)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
