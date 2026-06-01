"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";

export function LoginClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToastStore((state) => state.show);
  const loginWithPassword = useAuthStore((state) => state.loginWithPassword);
  const loading = useAuthStore((state) => state.loading);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const hydrated = useAuthStore((state) => state.hydrated);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (hydrated && isLoggedIn) router.replace(redirect);
  }, [hydrated, isLoggedIn, redirect, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await loginWithPassword(email, password, remember);
      showToast({ title: t("auth.welcomeBack"), tone: "success" });
      router.replace(redirect);
    } catch (error) {
      showToast({
        title: t("auth.loginFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  return (
    <main className="login-shell grid min-h-screen grid-cols-1 text-foreground lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden min-h-screen flex-col justify-between bg-[linear-gradient(135deg,#0d3f2a,#123a64)] p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-white/15">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-black">Yummy Go</p>
            <p className="text-sm text-white/65">{t("app.tagline")}</p>
          </div>
        </div>
        <div>
          <p className="max-w-xl text-5xl font-black leading-tight">
            {t("auth.heroTitle")}
          </p>
          <p className="mt-4 max-w-lg text-white/70">
            {t("auth.heroBody")}
          </p>
        </div>
        <p className="text-sm text-white/60">{t("auth.cleanInterface")}</p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-4 flex justify-end gap-2">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <ChefHat className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-black">{t("auth.signIn")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("auth.accessWorkspace")}</p>
              </div>
              <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                <Field>
                  <FieldLabel htmlFor="login-email">{t("auth.email")}</FieldLabel>
                  <Input
                    id="login-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="abc@gmail.com"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="login-password">{t("auth.password")}</FieldLabel>
                  <Input
                    id="login-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                  />
                </Field>
                <FieldGroup className="gap-3">
                  <Field orientation="horizontal">
                    <Checkbox id="login-remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                    <FieldLabel htmlFor="login-remember" className="text-muted-foreground">
                      {t("auth.rememberMe")}
                    </FieldLabel>
                  </Field>
                </FieldGroup>
                <Button className="w-full" disabled={loading}>
                  {loading ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
