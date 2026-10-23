"use client";

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useVisualEffectsTier } from "@/hooks/use-visual-effects-tier";
import { cn } from "@/lib/utils";

// One colour per step, so a cashier can tell "connection" from "what it prints" at a glance.
// Literal class strings so Tailwind emits them; status tokens keep dark mode and themes right.
export type SectionTone = "info" | "primary" | "warning" | "success";

const sectionTones: Record<SectionTone, { bar: string; border: string; chip: string; soft: string; text: string }> = {
  info: { bar: "bg-info", border: "border-info", chip: "bg-info text-info-foreground", soft: "bg-info/10", text: "text-info-text" },
  primary: { bar: "bg-primary", border: "border-primary", chip: "bg-primary text-primary-foreground", soft: "bg-primary/10", text: "text-primary-text" },
  success: { bar: "bg-success", border: "border-success", chip: "bg-success text-success-foreground", soft: "bg-success/10", text: "text-success-text" },
  warning: { bar: "bg-warning", border: "border-warning", chip: "bg-warning text-warning-foreground", soft: "bg-warning/10", text: "text-warning-text" },
};

export function sectionToneClasses(tone: SectionTone) {
  return sectionTones[tone];
}

/**
 * A numbered step of the printer form. The number is real order: the later steps depend on
 * the earlier ones (roles decide whether zone mapping is required, connection decides access).
 */
export function FormSection({
  action,
  children,
  description,
  icon: Icon,
  step,
  title,
  tone,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
  icon: LucideIcon;
  step: number;
  title: string;
  tone: SectionTone;
}) {
  const colors = sectionTones[tone];
  // Steps can appear mid-edit (the mapping step follows the kitchen/bar roles), so each one
  // eases in on mount instead of popping; Swan 1 and reduced-motion users get no motion.
  const tier = useVisualEffectsTier();

  return (
    <Card
      className={cn(
        "relative gap-4 px-4 shadow-dash-card sm:px-5",
        tier === "full" && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-500",
        tier === "lite" && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:fill-mode-both motion-safe:duration-300",
      )}
    >
      {/* Accent rule as a layer, not border-t: Swan 1's card border rule overrides card borders. */}
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", colors.bar)} />
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className={cn("relative flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm", colors.chip)}>
          <Icon className="size-5" />
          <span className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full border-2 border-card bg-foreground text-2xs font-bold text-background tabular-nums">
            {step}
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className={cn("text-base font-bold", colors.text)}>{title}</h2>
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

/**
 * Large picture-card choice in place of a <Select> for the few decisions that shape the rest of
 * the form (USB or WiFi, how the printer is tied to the menu). Each card says what it means.
 */
export function ChoiceCards({
  className,
  disabled,
  legend,
  name,
  options,
  tone,
  value,
  onValueChange,
}: {
  className?: string;
  disabled?: boolean;
  legend: string;
  name: string;
  options: ChoiceOption[];
  tone: SectionTone;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const colors = sectionTones[tone];

  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label" className="sr-only">
        {legend}
      </FieldLegend>
      <RadioGroup value={value} onValueChange={onValueChange} className={cn("grid gap-3 sm:grid-cols-2", className)}>
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
                "flex min-h-20 w-full cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                active ? cn(colors.border, colors.soft) : "border-border hover:bg-muted",
                off && "cursor-not-allowed opacity-50",
              )}
            >
              <RadioGroupItem id={id} value={option.value} disabled={off} className="sr-only" />
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  active ? colors.chip : cn(colors.soft, colors.text),
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("text-sm font-bold", active ? colors.text : "text-foreground")}>{option.label}</span>
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
