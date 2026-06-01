"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
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
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="login-light-zone relative min-h-screen overflow-hidden bg-[#f7fbfa] text-foreground">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-6 sm:top-6">
        <LanguageSwitch
          className="border border-emerald-100 bg-white/90 text-foreground shadow-sm backdrop-blur hover:bg-white"
          variant="outline"
        />
      </div>

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
        <section
          className="relative hidden min-h-screen overflow-hidden bg-emerald-50 lg:block"
          aria-hidden="true"
        >
          <Image
            src="/auth/login-hero.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 0px"
            className="object-cover object-center"
          />
          <div className="absolute inset-y-0 right-0 w-28 bg-gradient-to-r from-transparent to-[#f7fbfa]" />
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-20 sm:px-6 lg:px-12">
          <Card className="w-full max-w-[32rem] border-emerald-100/80 bg-white/95 shadow-[0_28px_80px_-44px_rgb(15_23_42/0.55)] backdrop-blur">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full border border-emerald-50 bg-white shadow-[0_18px_38px_-28px_rgb(15_23_42/0.65)]">
                  <Image
                    src="/brand/icon.png"
                    alt="Yummy Go"
                    width={42}
                    height={42}
                    priority
                    className="h-10 w-10 object-contain"
                  />
                </div>
                <h1 className="text-2xl font-black sm:text-3xl">{t("auth.signIn")}</h1>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  {t("auth.accessWorkspace")}
                </p>
              </div>

              <form className="flex flex-col gap-5" onSubmit={onSubmit}>
                <Field>
                  <FieldLabel htmlFor="login-email" className="font-black">
                    {t("auth.email")} <span className="text-destructive">*</span>
                  </FieldLabel>
                  <InputGroup className="login-input-group h-12 bg-white dark:bg-white">
                    <InputGroupAddon>
                      <Mail aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="login-email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      autoComplete="email"
                      placeholder="abc@gmail.com"
                      required
                    />
                  </InputGroup>
                </Field>

                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor="login-password" className="font-black">
                      {t("auth.password")} <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled
                      aria-disabled="true"
                      title={t("auth.unavailable")}
                      className="h-auto shrink-0 px-0 text-sm font-black text-primary hover:bg-transparent disabled:pointer-events-none disabled:opacity-60"
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>
                  <InputGroup className="login-input-group h-12 bg-white dark:bg-white">
                    <InputGroupAddon>
                      <LockKeyhole aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="login-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-sm"
                        aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>

                <FieldGroup className="gap-3">
                  <Field orientation="horizontal" className="items-center">
                    <Checkbox
                      id="login-remember"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                    />
                    <FieldLabel htmlFor="login-remember" className="font-black">
                      {t("auth.rememberMe")}
                    </FieldLabel>
                  </Field>
                </FieldGroup>

                <Button
                  className="h-12 w-full text-base font-black shadow-[0_18px_36px_-24px_rgb(15_135_94/0.9)]"
                  disabled={loading}
                >
                  {loading ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                <Separator className="flex-1" />
                <span>{t("auth.or")}</span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-full bg-white font-black"
                disabled
                aria-disabled="true"
                title={t("auth.unavailable")}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full border border-border text-xs font-black">
                  G
                </span>
                {t("auth.continueWithGoogle")}
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
