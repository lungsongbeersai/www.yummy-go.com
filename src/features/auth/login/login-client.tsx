"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { firstNavigablePath } from "@/components/layout/shell-menu-helpers";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { AppleIcon, GooglePlayIcon } from "./login-provider-icons";
import { LoginTrialStores } from "./login-trial-stores";
import { LoginAppDownloadPrompt } from "./login-app-download-prompt";
import {
  getDisplayedAppVersion,
  WEB_APP_VERSION,
} from "@/lib/installed-app-version";
import { internalRoute } from "@/lib/routes";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";
import { normalizeLoginEmail } from "@/lib/login-email";
import { isContractExpiredError } from "@/lib/contract-expiry";
import { authStoreUuid, type AuthUser, useAuthStore } from "@/stores/auth-store";
import { usePermissionsSidebarStore } from "@/stores/permissions-sidebar-store";
import { useToastStore } from "@/stores/toast-store";
import appVersionConfig from "../../../../public/app-version.json";

const loginInputGroupClassName = "h-13 overflow-hidden rounded-xl border-border bg-card shadow-xs transition-[border-color,box-shadow] duration-200 hover:border-primary/30 focus-within:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-4 has-[[data-slot=input-group-control]:focus-visible]:ring-primary/10 motion-reduce:transition-none";
const appDownloadButtonClassName = "h-auto min-h-14 min-w-0 w-full justify-start gap-2 rounded-xl border-border/80 bg-background/60 px-2.5 py-3 shadow-none transition-[background-color,border-color,box-shadow] duration-200 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm focus-visible:border-primary motion-reduce:transition-none sm:px-3";

// ไม่มี redirect param ชัดเจน (เช่น เข้า /login ตรง ๆ) — ปลายทางต้องมาจากเมนูที่สิทธิ์ผู้ใช้เปิดจริง
// ไม่ใช่ "/" ตายตัว เพราะ Dashboard ไม่เคยอยู่ใน permission tree ที่ backend ส่งมาเลย เรียกผ่าน
// usePermissionsSidebarStore.load() (store action) ไม่ใช่ service ตรง ๆ — component ต้องเรียกผ่าน
// store เท่านั้น (บังคับด้วย project-refactor-guards.test.ts, ไม่ใช่แค่ convention ใน docs)
// การเรียกซ้ำสองรอบ (เช่น React Strict Mode mount-cleanup-mount) ปลอดภัยเพราะ requestId ของ
// store เพิ่มขึ้นทุก call แบบ monotonic — รอบล่าสุดเสมอที่เป็นคน apply state ตอน fetch ของมันเองเสร็จ
// จึงห้ามมีจุดเรียกที่สองแยกต่างหาก (เช่นใน onSubmit) เพราะจะทำให้ "รอบล่าสุด" ไม่แน่นอนอีกต่อไป
async function resolveLandingPath(
  redirectParam: string | null,
  user: AuthUser | null,
  lang: string
): Promise<Route> {
  // AuthGuard เติม ?redirect=<pathname เดิม> ให้เองทุกครั้งที่เตะคนออกจากหน้าที่ต้อง login
  // (ดู unauthenticatedEntryPath ใน auth-guard.tsx) รวมถึงตอน logout จากหน้า "/" ก็เด้งมาเป็น
  // /login?redirect=%2F ด้วย — ถ้า honor ค่านี้ตรง ๆ จะวนกลับไป Dashboard ทุกครั้งไม่ต่างจากเดิม
  // เพราะ "/" ไม่เคยเป็น deep link ที่ผู้ใช้ตั้งใจไปจริง ๆ จึงต้องข้ามค่านี้แล้วคำนวณจากสิทธิ์แทน
  const explicitRedirect = redirectParam ? safeInternalRedirect(redirectParam) : null;
  if (explicitRedirect && explicitRedirect !== "/") return explicitRedirect;
  if (!user) return "/";

  const storeUuid = authStoreUuid(user);
  if (!storeUuid) return "/";

  try {
    await usePermissionsSidebarStore.getState().load(storeUuid, user.status, lang);
  } catch {
    return "/";
  }

  const items = usePermissionsSidebarStore.getState().items;
  const path = firstNavigablePath(items);
  return path ? internalRoute(path) : "/";
}

export function LoginClient() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToastStore((state) => state.show);
  const loginWithPassword = useAuthStore((state) => state.loginWithPassword);
  const loading = useAuthStore((state) => state.loading);
  const authError = useAuthStore((state) => state.error);
  const activeTrialStoreUuid = useAuthStore((state) => state.activeTrialStoreUuid);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [displayedVersion, setDisplayedVersion] = useState(WEB_APP_VERSION);

  const redirectParam = searchParams.get("redirect");
  const signingInAccount = loading && !activeTrialStoreUuid;

  useEffect(() => {
    if (!hydrated || !isLoggedIn) return;
    let cancelled = false;

    void resolveLandingPath(redirectParam, user, i18n.language).then((target) => {
      if (cancelled) return;
      router.replace(target);
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, isLoggedIn, redirectParam, user, i18n.language, router]);

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
    const normalizedEmail = normalizeLoginEmail(email);
    setEmail(normalizedEmail);

    try {
      const loggedInUser = await loginWithPassword(normalizedEmail, password, remember);
      if (!loggedInUser) return;

      // เด้งหน้าจริงปล่อยให้ effect ด้านบนทำ (มันฟัง isLoggedIn/user อยู่แล้ว) —
      // ถ้าเรียก resolveLandingPath ซ้ำที่นี่ด้วยจะยิง sidebar menu โหลดพร้อมกัน 2 รอบ
      // แล้วชนกันเอง (requestId guard ใน permissions-sidebar-store ทิ้งผลของรอบที่มาก่อน
      // ถ้ามันเสร็จก่อนอีกรอบ) ทำให้บางครั้งอ่าน items ว่างแล้ว fallback ไป "/" ทั้งที่มีสิทธิ์จริง
      showToast({ title: t("auth.welcomeBack"), tone: "success" });
    } catch (error) {
      if (isContractExpiredError(error)) {
        setPassword("");
        router.replace(internalRoute("/subscription-expired"));
        return;
      }
      showToast({
        title: t("auth.loginFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  return (
    // pt/pb บวก safe-area — บน Capacitor หน้าเว็บวาดใต้ status bar/แถบ gesture (edge-to-edge)
    // จัดกลางด้วย my-auto ของคอลัมน์แทน justify-center: ตอนคีย์บอร์ดเปิดแล้วเนื้อหาสูงกว่าจอ
    // justify-center ดันหัวการ์ดล้นขึ้นไปใต้ status bar จนเลื่อนกลับมาดูไม่ได้ ส่วน auto margin ไม่ล้น
    <main className="login-light-zone login-layout relative isolate flex min-h-svh flex-col items-center gap-4 bg-background px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] text-foreground sm:px-6 md:gap-3 md:px-10 md:pb-4 md:pt-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-warning/5 via-background to-primary/5" />
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-primary/10 blur-3xl sm:size-128" />
        <div className="absolute -bottom-48 -left-40 size-96 rounded-full bg-primary/10 blur-3xl sm:size-128" />
      </div>

      <LoginAppDownloadPrompt />

      {/* อยู่ใน container กว้างเท่าการ์ด เพื่อให้ปุ่มนำทางไม่ลอยชิดขอบจอบน desktop */}
      <div className="flex w-full max-w-md items-center justify-between gap-4 lg:max-w-7xl">
        <Button
          asChild
          variant="ghost"
          className="h-11 rounded-xl border-border/70 bg-card px-3 text-muted-foreground shadow-xs hover:border-primary/25 hover:bg-card hover:text-primary motion-reduce:transition-none"
        >
          <Link href="/home">
            <ArrowLeft className="size-4" />
            {t("auth.backToHome")}
          </Link>
        </Button>
        <LanguageSwitch variant="outline" className="h-11 rounded-xl bg-card sm:h-11" />
      </div>

      <div className="my-auto flex w-full max-w-md flex-col gap-3 lg:max-w-7xl">
        <Card className="grid gap-0 rounded-3xl p-0 shadow-xl shadow-foreground/5 ring-border/80 lg:grid-cols-[minmax(0,22fr)_minmax(0,78fr)]">
          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            <CardContent className="grid min-w-0 p-0 lg:grid-cols-[minmax(0,40fr)_minmax(0,38fr)]">
              <form
                className="flex w-full min-w-0 max-w-lg flex-col justify-center justify-self-center p-6 sm:p-8 lg:px-6 lg:py-5 xl:px-8"
                aria-labelledby="login-title"
                aria-describedby={authError ? "login-account-description login-account-error" : "login-account-description"}
                noValidate
                onSubmit={onSubmit}
              >
                <FieldGroup className="gap-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-primary/15">
                          <Image
                            src="/brand/icon-mark.png"
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        </span>
                        <span className="text-xl font-bold tracking-tight">YummyGo</span>
                      </div>
                      <Badge variant="secondary" className="h-auto shrink-0 gap-1.5 rounded-full bg-primary/8 px-2.5 py-1 font-lao text-xs text-primary">
                        <ShieldCheck aria-hidden />
                        {t("auth.accountSignIn.label")}
                      </Badge>
                    </div>

                    <div className="flex flex-col items-start gap-2 text-left">
                      <h1 id="login-title" tabIndex={-1} className="max-w-full text-balance text-2xl leading-snug font-semibold tracking-tight">{t("auth.accountSignIn.title")}</h1>
                      <p id="login-account-description" className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                        {t("auth.accountSignIn.description")}
                      </p>
                    </div>
                  </div>

                  {authError ? (
                    <Alert variant="destructive" id="login-account-error" className="gap-1 rounded-xl border-destructive/20 bg-destructive/5 p-3 font-lao">
                      <CircleAlert aria-hidden />
                      <AlertTitle>{t("auth.loginFailed")}</AlertTitle>
                      <AlertDescription className="break-words leading-relaxed">{authError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Field className="gap-2">
                    <FieldLabel htmlFor="login-email" className="text-sm font-semibold">
                      {t("auth.email")}
                    </FieldLabel>
                    {/* text-base below md: this route has no pinch-zoom lock, and iOS Safari
                        zooms into any input under 16px on focus. */}
                    <InputGroup className={loginInputGroupClassName}>
                      <InputGroupAddon className="pl-3.5 text-muted-foreground/75 group-focus-within/input-group:text-primary">
                        <Mail aria-hidden className="size-4" />
                      </InputGroupAddon>
                      <InputGroupInput
                        id="login-email"
                        name="email"
                        type="email"
                        placeholder=""
                        autoComplete="email"
                        spellCheck={false}
                        required
                        className="h-full pr-4 text-base md:text-base"
                        value={email}
                        onBlur={() => setEmail((value) => normalizeLoginEmail(value))}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </InputGroup>
                  </Field>

                  <Field className="gap-2">
                    <FieldLabel htmlFor="login-password" className="text-sm font-semibold">
                      {t("auth.password")}
                    </FieldLabel>
                    {/* overflow-hidden clips the input to the group's rounded inner edge: the
                        input is as tall as the bordered group, so Chrome's autofill fill would
                        otherwise paint over the group border and its corners. */}
                    <InputGroup className={loginInputGroupClassName}>
                      <InputGroupAddon className="pl-3.5 text-muted-foreground/75 group-focus-within/input-group:text-primary">
                        <LockKeyhole aria-hidden className="size-4" />
                      </InputGroupAddon>
                      <InputGroupInput
                        id="login-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        className="h-full text-base md:text-base"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <InputGroupAddon align="inline-end" className="py-0 pr-2">
                        <InputGroupButton
                          size="icon-sm"
                          className="size-11 rounded-lg text-muted-foreground hover:bg-primary/5 hover:text-primary motion-reduce:transition-none"
                          aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((value) => !value)}
                        >
                          {showPassword ? <EyeOff /> : <Eye />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <Field orientation="horizontal" className="-my-2 min-h-11 gap-3">
                    <Checkbox
                      id="login-remember"
                      name="remember"
                      className="size-5 rounded-md"
                      checked={remember}
                      onCheckedChange={(checked) => setRemember(checked === true)}
                    />
                    <FieldLabel htmlFor="login-remember" className="min-h-11 cursor-pointer text-sm font-normal">
                      {t("auth.rememberMe")}
                    </FieldLabel>
                  </Field>

                  <Field>
                    <Button
                      type="submit"
                      className="login-submit-button group/login-submit h-auto min-h-13 w-full gap-2 rounded-xl px-4 py-3 text-sm font-semibold whitespace-normal shadow-sm shadow-primary/20 transition-[background-color,box-shadow] duration-200 hover:bg-primary hover:shadow-md hover:shadow-primary/20 disabled:shadow-none motion-reduce:active:not-aria-[haspopup]:translate-y-0 motion-reduce:transition-none"
                      disabled={!hydrated || loading}
                      aria-busy={signingInAccount}
                    >
                      {signingInAccount ? <Spinner data-icon="inline-start" className="motion-reduce:animate-none" /> : null}
                      {signingInAccount ? t("auth.signingIn") : t("auth.accountSignIn.submit")}
                      {!signingInAccount ? <ArrowRight aria-hidden className="size-4 transition-transform duration-200 motion-safe:group-hover/login-submit:translate-x-0.5 motion-reduce:transition-none" /> : null}
                    </Button>
                  </Field>

                  <section className="border-t border-border/70 pt-4" aria-labelledby="login-app-downloads">
                    <h2
                      id="login-app-downloads"
                      className="mb-3 text-left text-xs font-medium text-muted-foreground"
                    >
                      {t("auth.downloadAppsTitle")}
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        asChild
                        variant="outline"
                        className={appDownloadButtonClassName}
                      >
                        <a
                          href={appVersionConfig.ios.storeUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t("auth.downloadFromAppStore")}
                        >
                          <AppleIcon className="size-6" />
                          <span className="flex min-w-0 flex-col items-start leading-none">
                            <span className="max-w-full whitespace-normal break-words text-2xs font-normal leading-tight text-muted-foreground">{t("auth.downloadOn")}</span>
                            <span className="mt-1 max-w-full whitespace-normal break-words text-xs font-semibold leading-tight sm:text-sm">App Store</span>
                          </span>
                        </a>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className={appDownloadButtonClassName}
                      >
                        <a
                          href={appVersionConfig.android.storeUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t("auth.downloadFromGooglePlay")}
                        >
                          <GooglePlayIcon className="size-6" />
                          <span className="flex min-w-0 flex-col items-start leading-none">
                            <span className="max-w-full whitespace-normal break-words text-2xs font-normal leading-tight text-muted-foreground">{t("auth.getItOn")}</span>
                            <span className="mt-1 max-w-full whitespace-normal break-words text-xs font-semibold leading-tight sm:text-sm">Google Play</span>
                          </span>
                        </a>
                      </Button>
                    </div>
                  </section>
                </FieldGroup>
              </form>

              <div className="relative hidden min-h-0 min-w-0 overflow-hidden border-l border-primary/10 bg-primary lg:block">
                <Image
                  src="/auth/login-hero.png"
                  alt=""
                  fill
                  preload
                  sizes="(min-width: 1440px) 486px, (min-width: 1024px) 38vw, 0px"
                  className="object-cover object-[60%_top]"
                />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-linear-to-t from-foreground via-foreground/85 to-transparent px-6 pt-24 pb-6 text-primary-foreground xl:px-8">
                  <p className="max-w-md text-pretty font-lao text-2xl leading-snug font-semibold">{t("auth.heroTitle")}</p>
                  <p className="max-w-md text-pretty font-lao text-sm leading-relaxed text-primary-foreground/85">{t("auth.heroBody")}</p>
                </div>
              </div>
            </CardContent>
          </div>

          {/* The login section sets the desktop row height; demo results scroll without stretching it. */}
          <aside className="min-w-0 border-t border-border lg:relative lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:self-stretch lg:border-t-0 lg:border-r" aria-labelledby="login-trial-title">
            <LoginTrialStores />
          </aside>
        </Card>

        <FieldDescription className="px-4 text-center text-xs">
          {t("auth.agreeToPolicy")} <Link href="/policy">{t("policy.title")}</Link>.{" "}
          {t("auth.version", { version: displayedVersion })}
        </FieldDescription>
      </div>
    </main>
  );
}
