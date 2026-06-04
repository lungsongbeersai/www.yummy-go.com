"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Save, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);

  const [displayName, setDisplayName] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user?.email ?? "");
  }, [user?.email]);

  function submitAccount(event: FormEvent) {
    event.preventDefault();
    showToast({ title: t("profile.saved"), tone: "success" });
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.validation.passwordMismatch"));
      return;
    }
    setPasswordError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    showToast({ title: t("profile.passwordChanged"), tone: "success" });
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
            <CardTitle>{t("profile.sections.account")}</CardTitle>
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
              <Button type="submit" size="sm" className="gap-2">
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
                {passwordError ? (
                  <FieldDescription className="text-destructive">{passwordError}</FieldDescription>
                ) : null}
              </FieldContent>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" size="sm" className="gap-2">
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
