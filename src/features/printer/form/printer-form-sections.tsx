"use client";

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/** One block of the printer form: a plain card with a heading. */
export function FormSection({
  action,
  children,
  description,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
  title: string;
}) {
  return (
    <Card className="gap-4 px-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </Card>
  );
}

export interface ChoiceOption {
  description?: string;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  value: string;
}

/** Card-style radio for the few choices that shape the rest of the form. */
export function ChoiceCards({
  className,
  disabled,
  legend,
  name,
  options,
  value,
  onValueChange,
}: {
  className?: string;
  disabled?: boolean;
  legend: string;
  name: string;
  options: ChoiceOption[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label" className="sr-only">
        {legend}
      </FieldLegend>
      <RadioGroup value={value} onValueChange={onValueChange} className={cn("grid gap-2 sm:grid-cols-2", className)}>
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          const active = value === option.value;
          const Icon = option.icon;
          const off = disabled || option.disabled;
          return (
            <FieldLabel
              key={option.value}
              htmlFor={id}
              className={cn(
                "flex min-h-14 w-full cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                active ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                off && "cursor-not-allowed opacity-50",
              )}
            >
              <RadioGroupItem id={id} value={option.value} disabled={off} className="sr-only" />
              <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                {option.description ? (
                  <FieldDescription className="text-xs leading-snug">{option.description}</FieldDescription>
                ) : null}
              </span>
            </FieldLabel>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}
