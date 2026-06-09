"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    <main className="login-light-zone relative min-h-screen overflow-hidden bg-[#f6fbf9] text-slate-950">
      <div className="absolute right-4 top-4 z-30 flex items-center gap-2 sm:right-6 sm:top-6">
        <LanguageSwitch
          className="border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur hover:bg-white"
          variant="outline"
        />
      </div>

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.04fr)_minmax(30rem,0.96fr)]">
        <section
          className="relative hidden min-h-screen overflow-hidden bg-[#f4eee8] lg:block"
          aria-hidden="true"
        >
          <Image
            src="/auth/login-hero.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 54vw, 0px"
            className="object-cover object-center"
          />

          <div className="absolute inset-0 bg-white/20" />
          <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-pr from-transparent to-[#f6fbf9]" />
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-12">
          <Card className="w-full max-w-md rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.5)] backdrop-blur">
            <CardContent className="px-6 py-8 sm:px-8 sm:py-9">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_16px_36px_-26px_rgba(15,23,42,0.55)]">
                  <Image
                    src="/brand/icon.png"
                    alt="Yummy Go"
                    width={38}
                    height={38}
                    priority
                    className="h-9 w-9 object-contain"
                  />
                </div>

                <h1 className="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-[1.7rem]">
                  {t("auth.signIn")}
                </h1>

                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  {t("auth.accessWorkspace")}
                </p>
              </div>

              <form className="flex flex-col gap-5" onSubmit={onSubmit}>
                <Field>
                  <FieldLabel htmlFor="login-email" className="text-sm font-black text-slate-600">
                    {t("auth.email")} <span className="text-red-500">*</span>
                  </FieldLabel>

                  <Input
                    id="login-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    required
                    className="h-12 rounded-lg border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                  />
                </Field>

                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel
                      htmlFor="login-password"
                      className="text-sm font-black text-slate-600"
                    >
                      {t("auth.password")} <span className="text-red-500">*</span>
                    </FieldLabel>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled
                      aria-disabled="true"
                      title={t("auth.unavailable")}
                      className="h-auto shrink-0 px-0 text-xs font-black text-emerald-600 hover:bg-transparent hover:text-emerald-700 disabled:pointer-events-none disabled:opacity-70"
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>

                  <div className="relative">
                    <Input
                      id="login-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      className="h-12 rounded-lg border-slate-200 bg-white px-4 pr-11 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                    />

                    <button
                      type="button"
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                      {showPassword ? (
                        <EyeOff aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>

                <div className="flex items-center justify-between gap-3">
                  <FieldGroup className="gap-0">
                    <Field orientation="horizontal" className="items-center gap-2">
                      <Checkbox
                        id="login-remember"
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                      />

                      <FieldLabel
                        htmlFor="login-remember"
                        className="text-sm font-black text-slate-700"
                      >
                        {t("auth.rememberMe")}
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                </div>

                <Button
                  className="mt-1 h-12 w-full rounded-lg bg-emerald-600 text-base font-black text-white shadow-[0_18px_34px_-24px_rgba(5,150,105,0.95)] transition hover:bg-emerald-700"
                  disabled={loading}
                >
                  {loading ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>

              <p className="mt-5 text-center text-sm font-semibold text-slate-500">
                {t("auth.noAccount")}{" "}
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title={t("auth.unavailable")}
                  className="font-black text-emerald-600 disabled:pointer-events-none disabled:opacity-70"
                >
                  {t("auth.register")}
                </button>
              </p>

              <div className="my-6 flex items-center gap-3 text-xs font-bold text-slate-400">
                <Separator className="flex-1 bg-slate-200" />
                <span>{t("auth.or")}</span>
                <Separator className="flex-1 bg-slate-200" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-lg border-slate-200 bg-white text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:text-slate-400"
                disabled
                aria-disabled="true"
                title={t("auth.unavailable")}
              >
                {t("auth.continueWithGoogle")}
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}