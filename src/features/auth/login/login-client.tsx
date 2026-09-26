"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { firstNavigablePath } from "@/components/layout/shell-menu-helpers";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { AppleIcon, GooglePlayIcon } from "./login-provider-icons";
import {
  getDisplayedAppVersion,
  WEB_APP_VERSION,
} from "@/lib/installed-app-version";
import { internalRoute } from "@/lib/routes";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";
import { normalizeLoginEmail } from "@/lib/login-email";
import { authStoreUuid, type AuthUser, useAuthStore } from "@/stores/auth-store";
import { usePermissionsSidebarStore } from "@/stores/permissions-sidebar-store";
import { useToastStore } from "@/stores/toast-store";
import appVersionConfig from "../../../../public/app-version.json";

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
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [displayedVersion, setDisplayedVersion] = useState(WEB_APP_VERSION);

  const redirectParam = searchParams.get("redirect");

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
    <main className="login-light-zone login-layout relative isolate flex min-h-svh flex-col items-center gap-4 bg-muted px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:px-6 md:px-10 md:pb-6 md:pt-6">
      {/* Full-screen backdrop, softened so the card and the footer text stay readable. */}
      <Image
        src="/auth/login-hero.png"
        alt=""
        fill
        preload
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-background/70 backdrop-blur-md" />

      {/* อยู่ใน container กว้างเท่าการ์ด เพื่อให้ปุ่มนำทางไม่ลอยชิดขอบจอบน desktop */}
      <div className="flex w-full max-w-md items-center justify-between md:max-w-6xl">
        <Button
          asChild
          variant="ghost"
          className="h-10 rounded-xl bg-background/65 px-3 text-muted-foreground shadow-sm backdrop-blur-md hover:bg-background hover:text-foreground"
        >
          <Link href="/home">
            <ArrowLeft className="size-4" />
            {t("auth.backToHome")}
          </Link>
        </Button>
        <LanguageSwitch variant="outline" />
      </div>

      <div className="my-auto flex w-full max-w-md flex-col gap-5 md:max-w-6xl">
        <Card className="overflow-hidden rounded-2xl p-0 shadow-2xl ring-1 ring-foreground/10">
          <CardContent className="grid p-0 md:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
            <form className="flex flex-col justify-center p-7 sm:p-8 lg:p-10" noValidate onSubmit={onSubmit}>
              <FieldGroup className="gap-4">
                <div className="flex items-center justify-center gap-3 text-center">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-foreground/10">
                    <Image
                      src="/brand/icon-mark.png"
                      alt="YummyGo"
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-bold tracking-tight">YummyGo</p>
                    <p className="text-xs text-muted-foreground">{t("auth.productName")}</p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-1.5 text-left">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("auth.welcomeBack")}</h1>
                  <p className="max-w-md text-balance text-sm leading-relaxed text-muted-foreground">
                    {t("auth.accessWorkspace")}
                  </p>
                </div>

                <Field className="gap-2.5">
                  <FieldLabel htmlFor="login-email" className="text-sm font-semibold">
                    {t("auth.email")}
                  </FieldLabel>
                  {/* text-base below md: this route has no pinch-zoom lock, and iOS Safari
                      zooms into any input under 16px on focus. */}
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    className="login-input h-12 rounded-xl bg-card px-4 text-base shadow-sm md:text-base"
                    value={email}
                    onBlur={() => setEmail((value) => normalizeLoginEmail(value))}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>

                <Field className="gap-2.5">
                  <FieldLabel htmlFor="login-password" className="text-sm font-semibold">
                    {t("auth.password")}
                  </FieldLabel>
                  {/* overflow-hidden clips the input to the group's rounded inner edge: the
                      input is as tall as the bordered group, so Chrome's autofill fill would
                      otherwise paint over the group border and its corners. */}
                  <InputGroup className="h-12 overflow-hidden rounded-xl bg-card shadow-sm">
                    <InputGroupInput
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      className="px-4 text-base md:text-base"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <InputGroupAddon align="inline-end" className="pr-2">
                      <InputGroupButton
                        size="icon-sm"
                        className="size-9 rounded-lg"
                        aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>

                {/* Not in login-04, but it controls whether the session survives a restart. */}
                <Field orientation="horizontal" className="min-h-8 gap-3">
                  <Checkbox
                    id="login-remember"
                    name="remember"
                    checked={remember}
                    onCheckedChange={(checked) => setRemember(checked === true)}
                  />
                  <FieldLabel htmlFor="login-remember" className="text-sm font-normal">
                    {t("auth.rememberMe")}
                  </FieldLabel>
                </Field>

                <Field>
                  <Button
                    type="submit"
                    className="login-submit-button h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/20"
                    disabled={loading}
                  >
                    {loading ? <Spinner data-icon="inline-start" /> : null}
                    {loading ? t("auth.signingIn") : t("auth.signIn")}
                  </Button>
                </Field>

                <section
                  className="rounded-2xl bg-muted/70 p-3.5 ring-1 ring-border"
                  aria-labelledby="login-app-downloads"
                >
                  <h2 id="login-app-downloads" className="mb-2.5 text-sm font-semibold">
                    {t("auth.downloadAppsTitle")}
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      asChild
                      variant="outline"
                      className="h-12 justify-start rounded-xl border-foreground/15 bg-foreground px-3.5 text-background shadow-sm hover:bg-foreground/90 hover:text-background"
                    >
                      <a
                        href={appVersionConfig.ios.storeUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t("auth.downloadFromAppStore")}
                      >
                        <AppleIcon className="size-6" />
                        <span className="flex flex-col items-start leading-none">
                          <span className="text-[0.625rem] font-normal opacity-80">{t("auth.downloadOn")}</span>
                          <span className="mt-1 text-sm font-semibold">App Store</span>
                        </span>
                      </a>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-12 justify-start rounded-xl border-foreground/15 bg-foreground px-3.5 text-background shadow-sm hover:bg-foreground/90 hover:text-background"
                    >
                      <a
                        href={appVersionConfig.android.storeUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t("auth.downloadFromGooglePlay")}
                      >
                        <GooglePlayIcon className="size-6" />
                        <span className="flex flex-col items-start leading-none">
                          <span className="text-[0.625rem] font-normal opacity-80">{t("auth.getItOn")}</span>
                          <span className="mt-1 text-sm font-semibold">Google Play</span>
                        </span>
                      </a>
                    </Button>
                  </div>
                </section>
              </FieldGroup>
            </form>

            <div className="relative hidden min-h-[36rem] overflow-hidden bg-muted lg:min-h-[38rem] md:block">
              <Image
                src="/auth/login-hero.png"
                alt=""
                fill
                sizes="(min-width: 1280px) 34rem, (min-width: 768px) 44vw, 0px"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 via-foreground/55 to-transparent p-7 pt-24 text-background lg:p-8 lg:pt-28">
                <p className="max-w-md text-2xl font-bold leading-tight">{t("auth.heroTitle")}</p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-background/85">{t("auth.heroBody")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <FieldDescription className="px-4 text-center text-xs">
          {t("auth.agreeToPolicy")} <Link href="/policy">{t("policy.title")}</Link>.{" "}
          {t("auth.version", { version: displayedVersion })}
        </FieldDescription>
      </div>
    </main>
  );
}
