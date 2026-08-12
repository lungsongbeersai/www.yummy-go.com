"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

// เที่ยงคืนตาม local time เสมอ (ไม่ใช้ UTC) กันวันเพี้ยนข้ามคืนตอนแปลงกลับไป-มากับ Calendar ของ react-day-picker
function partsToDate({ day, month, year }: DateParts) {
  return new Date(year, month - 1, day);
}

function dateToParts(date: Date): DateParts {
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
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
  const selectedDate = partsToDate(reportDateParts(value));

  // date-fns ไม่มี locale ภาษาลาว (lo) ให้ dropdown เดือนของ react-day-picker ใช้
  // จึงใช้ชื่อเดือนชุดเดียวกับหน้า dashboard (dashboard.months) แทน ให้ตรงภาษาระบบเสมอ
  const monthNames = t("dashboard.months", { returnObjects: true });
  const formatMonthDropdown = Array.isArray(monthNames)
    ? (date: Date) => (monthNames as string[])[date.getMonth()]
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>

      {name ? <input type="hidden" name={name} value={value} autoComplete={autoComplete} /> : null}

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          formatters={formatMonthDropdown ? { formatMonthDropdown } : undefined}
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onValueChange(reportDateValue(dateToParts(date)));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
