"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface DocumentLogoCheckboxProps {
  checked: boolean | "indeterminate";
  className?: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function DocumentLogoCheckbox({ checked, className, disabled, onCheckedChange }: DocumentLogoCheckboxProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <Field orientation="horizontal" data-disabled={disabled} className={cn("min-h-11 gap-2", className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <FieldLabel htmlFor={id} className="min-h-11 cursor-pointer font-lao">
        {t("pos.showDocumentLogo")}
      </FieldLabel>
    </Field>
  );
}
