"use client";

import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChangePasswordFields } from "@/components/common/change-password-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useChangePasswordForm } from "@/hooks/use-change-password-form";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import type { ChangePasswordValues } from "@/lib/password";

export function UserPasswordDialog({
  email,
  onOpenChange,
  onSubmit,
  open,
  saving
}: {
  email: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ChangePasswordValues) => Promise<void>;
  open: boolean;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const { error, reset, setValue, validate, values } = useChangePasswordForm();

  // เปิด/ปิด dialog = เริ่มฟอร์มเปล่า ไม่ค้างรหัสผ่านที่พิมพ์ไว้รอบก่อน
  useResetOnChange(open, reset);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = validate();
    if (payload) await onSubmit(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{t("settings.changePassword")}</DialogTitle>
          <DialogDescription>{t("settings.changePasswordHint")}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor="user-change-password-email">{t("fields.login_email")}</FieldLabel>
            <Input
              aria-readonly
              id="user-change-password-email"
              readOnly
              translate="no"
              value={email || "-"}
            />
          </Field>
          <ChangePasswordFields
            disabled={saving}
            error={error}
            idPrefix="user-change-password"
            values={values}
            onValueChange={setValue}
          />
          <DialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("profile.actions.updatePassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
