"use client";

import { useEffect, useRef } from "react";
import { Checkbox, type CheckboxProps } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { safeId, type CheckboxOption } from "./printer-form-utils";

export function IndeterminateCheckbox({
  indeterminate = false,
  ...props
}: CheckboxProps & { indeterminate?: boolean }) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <Checkbox
      ref={checkboxRef}
      aria-checked={indeterminate ? "mixed" : props.checked ? "true" : "false"}
      {...props}
    />
  );
}

export function CheckboxOptionList({
  description,
  emptyLabel,
  legend,
  name,
  options,
  selectAllLabel,
  selected,
  onToggle,
  onToggleAll,
}: {
  description: string;
  emptyLabel: string;
  legend: string;
  name: string;
  options: CheckboxOption[];
  selectAllLabel: string;
  selected: string[];
  onToggle: (value: string) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const optionValues = options.map((option) => option.value);
  const selectedCount = optionValues.filter((value) =>
    selected.includes(value),
  ).length;
  const allSelected = selectedCount === options.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const selectAllId = safeId(name, "select-all");

  return (
    <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <FieldLegend className="mb-1 text-sm font-black">{legend}</FieldLegend>
        <FieldDescription>{description}</FieldDescription>
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
              onChange={(event) => onToggleAll(event.currentTarget.checked)}
            />
            <FieldLabel htmlFor={selectAllId} className="font-black">
              {selectAllLabel}
            </FieldLabel>
          </Field>
          {options.map((option) => {
            const id = safeId(name, option.value);
            return (
              <Field
                key={option.value}
                orientation="horizontal"
                className="rounded-md border border-border p-3"
              >
                <Checkbox
                  id={id}
                  checked={selected.includes(option.value)}
                  onChange={() => onToggle(option.value)}
                />
                <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
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
