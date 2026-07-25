"use client";

import { useState, type FormEvent } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { Save, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  const [displayName, setDisplayName] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // สลับผู้ใช้ = แสดงชื่อของผู้ใช้คนใหม่
  useResetOnChange(user?.email, () => setDisplayName(user?.email ?? ""));

  // Backend ยังไม่มี endpoint สำหรับบันทึกโปรไฟล์/เปลี่ยนรหัสผ่าน — ปิดปุ่ม submit
  // ไว้ก่อน (coming soon) แทนที่จะยิง toast สำเร็จหลอกๆ ไม่มีผลจริง
  function submitAccount(event: FormEvent) {
    event.preventDefault();
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
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
            <div className="flex items-center gap-2">
              <CardTitle>{t("profile.sections.password")}</CardTitle>
              <Badge variant="secondary">{t("nav.coming_soon")}</Badge>
            </div>
            <p className="text-[13px] text-muted-foreground">{t("profile.sections.passwordHint")}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPassword} className="flex flex-col gap-5">
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="currentPassword">{t("profile.fields.currentPassword")}</FieldLabel>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="newPassword">{t("profile.fields.newPassword")}</FieldLabel>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="confirmPassword">{t("profile.fields.confirmPassword")}</FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </FieldContent>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" size="sm" className="gap-2" disabled>
                <Save className="size-4" />
                {t("profile.actions.updatePassword")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
