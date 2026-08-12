"use client";

import { useTranslation } from "react-i18next";
import { PasswordInput } from "@/components/common/password-input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { ChangePasswordValues } from "@/lib/password";

export function ChangePasswordFields({
  disabled,
  error,
  idPrefix,
  onValueChange,
  values
}: {
  disabled?: boolean;
  error: string | null;
  idPrefix: string;
  onValueChange: (field: keyof ChangePasswordValues, value: string) => void;
  values: ChangePasswordValues;
}) {
  const { t } = useTranslation();
  const errorId = `${idPrefix}-error`;
  const invalid = Boolean(error);
  const describedBy = invalid ? errorId : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-current`}>{t("profile.fields.currentPassword")}</FieldLabel>
        <PasswordInput
          aria-describedby={describedBy}
          aria-invalid={invalid}
          autoComplete="current-password"
          disabled={disabled}
          id={`${idPrefix}-current`}
          required
          value={values.oldPassword}
          onChange={(event) => onValueChange("oldPassword", event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-new`}>{t("profile.fields.newPassword")}</FieldLabel>
        <PasswordInput
          aria-describedby={describedBy}
          aria-invalid={invalid}
          autoComplete="new-password"
          disabled={disabled}
          id={`${idPrefix}-new`}
          required
          value={values.newPassword}
          onChange={(event) => onValueChange("newPassword", event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-confirm`}>{t("profile.fields.confirmPassword")}</FieldLabel>
        <PasswordInput
          aria-describedby={describedBy}
          aria-invalid={invalid}
          autoComplete="new-password"
          disabled={disabled}
          id={`${idPrefix}-confirm`}
          required
          value={values.confirmPassword}
          onChange={(event) => onValueChange("confirmPassword", event.target.value)}
        />
      </Field>
      {invalid ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
