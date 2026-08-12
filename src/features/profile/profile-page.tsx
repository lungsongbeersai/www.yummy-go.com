"use client";

import { useState, type FormEvent } from "react";
import { useChangePasswordForm } from "@/hooks/use-change-password-form";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { Save, UserCircle } from "lucide-react";
import { ChangePasswordFields } from "@/components/common/change-password-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const changePassword = useReferenceStore((state) => state.changePassword);
  const changingPassword = useReferenceStore((state) => Boolean(state.loadingKeys.password));
  const { error, reset, setValue, validate, values } = useChangePasswordForm();

  const [displayName, setDisplayName] = useState(user?.email ?? "");

  // สลับผู้ใช้ = แสดงชื่อของผู้ใช้คนใหม่ และล้างฟอร์มรหัสผ่านที่ค้างอยู่ของคนก่อน
  useResetOnChange(user?.email, () => {
    setDisplayName(user?.email ?? "");
    reset();
  });

  // Backend ยังไม่มี endpoint สำหรับบันทึกชื่อ/อีเมลโปรไฟล์ — ปิดปุ่ม submit ไว้ก่อน
  // (coming soon) แทนที่จะยิง toast สำเร็จหลอกๆ ไม่มีผลจริง
  function submitAccount(event: FormEvent) {
    event.preventDefault();
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    const payload = validate();
    if (!payload) return;

    try {
      await changePassword({
        login_uuid: user?.uuid ?? "",
        old_password: payload.oldPassword,
        new_password: payload.newPassword
      });
      showToast({ title: t("profile.passwordChanged"), tone: "success" });
      reset();
    } catch (requestError) {
      showToast({
        title: t("profile.changePasswordFailed"),
        description: requestError instanceof Error ? requestError.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-black">{t("profile.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>{t("profile.sections.avatar")}</CardTitle>
            <p className="text-[13px] text-muted-foreground">{t("profile.sections.avatarHint")}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid size-20 place-items-center rounded-full bg-muted text-muted-foreground">
              <UserCircle className="size-12" />
            </div>
            <Button type="button" variant="outline" size="sm" disabled>
              {t("profile.actions.changePhoto")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <CardTitle>{t("profile.sections.account")}</CardTitle>
              <Badge variant="secondary">{t("nav.coming_soon")}</Badge>
            </div>
            <p className="text-[13px] text-muted-foreground">{t("profile.sections.accountHint")}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitAccount} className="flex flex-col gap-5">
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="displayName">{t("profile.fields.displayName")}</FieldLabel>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="email">{t("profile.fields.email")}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={user?.email ?? ""}
                  placeholder="abc@gmail.com"
                  disabled
                  readOnly
                />
              </FieldContent>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" size="sm" className="gap-2" disabled>
                <Save className="size-4" />
                {t("profile.actions.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>{t("profile.sections.password")}</CardTitle>
            <p className="text-[13px] text-muted-foreground">{t("profile.sections.passwordHint")}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPassword} className="flex flex-col gap-5">
            <ChangePasswordFields
              disabled={changingPassword}
              error={error}
              idPrefix="profile-password"
              values={values}
              onValueChange={setValue}
            />
            <div className="flex justify-end">
              <Button className="gap-2" disabled={changingPassword || !user?.uuid} size="sm" type="submit">
                {changingPassword ? <Spinner /> : <Save className="size-4" />}
                {changingPassword ? t("common.processing") : t("profile.actions.updatePassword")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
