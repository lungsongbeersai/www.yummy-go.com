"use client";

import { useTranslation } from "react-i18next";
import type * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox, type CheckboxProps } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { optionRowClass, safeId, type CheckboxOption } from "./printer-form-utils";

export function IndeterminateCheckbox({
  indeterminate = false,
  checked,
  ...props
}: CheckboxProps & { indeterminate?: boolean }) {
  return (
    <Checkbox
      checked={indeterminate ? "indeterminate" : checked}
      {...props}
    />
  );
}

export function CheckboxOptionList({
  className,
  description,
  emptyLabel,
  legend,
  name,
  options,
  required = false,
  selectAllLabel,
  selected,
  onToggle,
  onToggleAll,
}: {
  className?: string;
  description: string;
  emptyLabel: string;
  legend: string;
  name: string;
  options: CheckboxOption[];
  required?: boolean;
  selectAllLabel: string;
  selected: string[];
  onToggle: (value: string) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const optionValues = options.map((option) => option.value);
  const selectedCount = optionValues.filter((value) =>
    selected.includes(value),
  ).length;
  const allSelected = selectedCount === options.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const selectAllId = safeId(name, "select-all");
  const missingRequired = required && selectedCount === 0;

  return (
    <FieldSet className={cn("gap-4 rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <FieldLegend className="mb-1 text-sm font-black">
            {legend}
            {required ? <span className="text-destructive"> *</span> : null}
          </FieldLegend>
          <FieldDescription>{description}</FieldDescription>
        </div>
        {options.length ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
              missingRequired
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t("printer.selectedCount", {
              selected: selectedCount,
              total: options.length,
            })}
          </span>
        ) : null}
      </div>
      {options.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field
            orientation="horizontal"
            className="rounded-md border border-border bg-muted/30 p-3 sm:col-span-2"
          >
            <IndeterminateCheckbox
              id={selectAllId}
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={(checked) => onToggleAll(checked as boolean)}
            />
            <FieldLabel htmlFor={selectAllId} className="font-black">
              {selectAllLabel}
            </FieldLabel>
          </Field>
          {options.map((option) => {
            const id = safeId(name, option.value);
            const checked = selected.includes(option.value);
            return (
              <Field
                key={option.value}
                orientation="horizontal"
                className={optionRowClass(checked)}
                onClick={(event) => {
                  // Radix Checkbox ซ่อน <input type="checkbox"> ไว้ข้างในเพื่อ sync กับ native form
                  // และยิง click event ของมันเองทุกครั้งที่ checked เปลี่ยน (ไม่มี role="checkbox")
                  // ถ้าไม่กันด้วย input ตรงนี้ click นั้นจะ bubble มาเข้า onToggle ซ้ำ กลายเป็น toggle
                  // วนไม่รู้จบ (setState loop) — label/[role=checkbox] กันคลิกจริงจากผู้ใช้อยู่แล้ว
                  const target = event.target as HTMLElement;
                  if (target.closest('label, input, [role="checkbox"]')) return;
                  onToggle(option.value);
                }}
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={() => onToggle(option.value)}
                />
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
                  {option.assignedTo?.length ? (
                    <FieldDescription className="mt-0.5 truncate text-2xs">
                      {t("printer.alreadyAssignedTo", {
                        printers: option.assignedTo.join(", "),
                      })}
                    </FieldDescription>
                  ) : null}
                </div>
              </Field>
            );
          })}
        </div>
      ) : (
        <FieldDescription>{emptyLabel}</FieldDescription>
      )}
    </FieldSet>
  );
}

export interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// การ์ดเลือกแบบเดียวกับ CheckboxOptionList (optionRowClass) — เดิม radio ใช้แค่ circle + label
// เปล่าๆ เรียงเป็นแถวยาว ดูไม่เข้าชุดกับ checkbox list ที่เหลือในฟอร์มเดียวกัน จึงย้ายมาใช้สไตล์เดียวกัน
// ใช้ FieldSet/FieldLegend แทน FieldLabel เดิม เพราะหัวข้อเป็นชื่อกลุ่ม ไม่ใช่ label ของ radio ตัวใดตัวหนึ่ง
export function RadioOptionList({
  autoFocusFirst = false,
  className,
  description,
  disabled,
  legend,
  name,
  options,
  optionsClassName,
  value,
  onValueChange,
}: {
  autoFocusFirst?: boolean;
  className?: string;
  description: string;
  disabled?: boolean;
  legend: string;
  name: string;
  options: RadioOption[];
  optionsClassName?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <FieldSet className={cn("gap-2", className)}>
      <div>
        <FieldLegend className="mb-1 text-sm font-black">{legend}</FieldLegend>
        <FieldDescription>{description}</FieldDescription>
      </div>
      <RadioGroup
        value={value}
        onValueChange={onValueChange}
        className={cn("grid gap-2 sm:grid-cols-2", optionsClassName)}
      >
        {options.map((option, index) => {
          const id = safeId(name, option.value);
          const active = value === option.value;
          return (
            <Field
              key={option.value}
              orientation="horizontal"
              className={cn(optionRowClass(active), (disabled || option.disabled) && "cursor-not-allowed opacity-50")}
              onClick={(event) => {
                // เหมือน CheckboxOptionList — กัน native input ที่ Radix ซ่อนไว้ยิง click ซ้ำเข้ามา
                const target = event.target as HTMLElement;
                if (target.closest('label, input, [role="radio"]')) return;
                if (!disabled && !option.disabled) onValueChange(option.value);
              }}
            >
              <RadioGroupItem id={id} value={option.value} disabled={disabled || option.disabled} autoFocus={autoFocusFirst && index === 0} />
              <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
            </Field>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}

// การ์ดหนึ่งขั้นของฟอร์มเครื่องพิมพ์ — เลขลำดับช่วยให้ผู้ใช้รู้ว่ากรอกถึงไหนแล้ว แทนการ์ดยาวการ์ดเดียวแบบเดิม
export function PrinterFormSection({
  step,
  title,
  description,
  action,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground tabular-nums"
          >
            {step}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
