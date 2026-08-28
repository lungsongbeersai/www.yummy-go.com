"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getDisplayedAppVersion,
  WEB_APP_VERSION,
} from "@/lib/installed-app-version";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";
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
  const offlineSession = useAuthStore((state) => state.offlineSession);
  const hydrated = useAuthStore((state) => state.hydrated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [displayedVersion, setDisplayedVersion] = useState(WEB_APP_VERSION);

  const redirect = safeInternalRedirect(searchParams.get("redirect"));

  useEffect(() => {
    if (!hydrated || !isLoggedIn) return;
    if (offlineSession) window.location.replace(redirect);
    else router.replace(redirect);
  }, [hydrated, isLoggedIn, offlineSession, redirect, router]);

  useEffect(() => {
    let active = true;

    void getDisplayedAppVersion().then((version) => {
      if (active) setDisplayedVersion(version);
    });

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      const user = await loginWithPassword(email, password, remember);
      if (!user) return;

      showToast({ title: t("auth.welcomeBack"), tone: "success" });
      if (useAuthStore.getState().offlineSession) window.location.replace(redirect);
      else router.replace(redirect);
    } catch (error) {
      showToast({
        title: t("auth.loginFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  return (
    <main className="login-light-zone relative min-h-screen min-h-[100dvh] overflow-x-hidden overflow-y-auto bg-background text-foreground">
      <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top,0px))] z-30 flex items-center gap-2 sm:right-6 sm:top-[calc(1.5rem+env(safe-area-inset-top,0px))]">
        <LanguageSwitch
          className="border border-border bg-card/95 text-muted-foreground shadow-sm backdrop-blur hover:bg-card"
          variant="outline"
        />
      </div>

      <div className="login-layout grid min-h-screen min-h-[100dvh] grid-cols-1 lg:grid-cols-[minmax(0,1.04fr)_minmax(30rem,0.96fr)]">
        <section
          className="login-hero-section relative hidden min-h-screen min-h-[100dvh] overflow-hidden bg-[#f4eee8] lg:block"
          aria-hidden="true"
        >
          <Image
            src="/auth/login-hero.png"
            alt=""
            fill
            preload
            sizes="(min-width: 1024px) 54vw, 0px"
            className="object-cover object-center"
          />

          <div className="login-hero-overlay absolute inset-0 bg-card/20" />
          <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-pr from-transparent to-background" />
        </section>

        <section className="login-panel-section flex min-h-screen min-h-[100dvh] items-center justify-center px-4 py-16 sm:px-6 lg:px-12">
          <Card className="login-card w-full max-w-md rounded-[22px] border-border/80 bg-card/95 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.5)] backdrop-blur">
            <CardContent className="px-6 py-8 sm:px-8 sm:py-9">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card shadow-[0_16px_36px_-26px_rgba(15,23,42,0.55)]">
                  <Image
                    src="/brand/icon.png"
                    alt="Yummy Go"
                    width={38}
                    height={38}
                    preload
                    className="h-9 w-9 object-contain"
                  />
                </div>

                <h1 className="text-2xl font-black leading-tight tracking-tight text-foreground sm:text-[1.7rem]">
                  {t("auth.signIn")}
                </h1>

                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                  {t("auth.accessWorkspace")}
                </p>
              </div>

              <form className="flex flex-col gap-5" onSubmit={onSubmit}>
                <Field>
                  <FieldLabel htmlFor="login-email" className="text-sm font-black text-muted-foreground">
                    {t("auth.email")} <span className="text-destructive">*</span>
                  </FieldLabel>

                  <Input
                    id="login-email"
                    name="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    className="login-input h-12 rounded-lg border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                  />
                </Field>

                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel
                      htmlFor="login-password"
                      className="text-sm font-black text-muted-foreground"
                    >
                      {t("auth.password")} <span className="text-destructive">*</span>
                    </FieldLabel>
                  </div>

                  <div className="relative">
                    <Input
                      id="login-password"
                      name="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      className="login-input h-12 rounded-lg border-border bg-card px-4 pr-12 text-sm font-semibold text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-0 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff aria-hidden="true" />
                      ) : (
                        <Eye aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </Field>

                <div className="flex items-center justify-between gap-3">
                  <FieldGroup className="gap-0">
                    <Field orientation="horizontal" className="items-center gap-2">
                      <Checkbox
                        id="login-remember"
                        name="remember"
                        checked={remember}
                        onCheckedChange={(checked) => setRemember(checked as boolean)}
                        className="h-4 w-4 rounded border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      />

                      <FieldLabel
                        htmlFor="login-remember"
                        className="text-sm font-black text-foreground"
                      >
                        {t("auth.rememberMe")}
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                </div>

                <Button
                  type="submit"
                  className="login-submit-button mt-1 h-12 w-full rounded-lg bg-primary text-base font-black text-primary-foreground shadow-[0_18px_34px_-24px_rgba(5,150,105,0.95)] transition hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>

              <p className="mt-5 text-center text-xs font-semibold leading-5 text-muted-foreground">
                {t("auth.version", { version: displayedVersion })}
              </p>

              <div className="mt-3 text-center">
                <Link
                  href="/policy"
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-xs font-black text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("policy.title")}
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
