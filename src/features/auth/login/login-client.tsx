"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
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
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { AppleIcon, GoogleIcon, MetaIcon } from "./login-provider-icons";
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

  // Layout mirrors shadcn's login-04 block element for element. The login-* class names
  // are hooks for the forced-light token scope and the Capacitor Android WebView fixes in
  // globals.css, not styling. Social sign-in, password reset and sign-up are not built
  // yet, so those controls are rendered disabled to keep the block's layout.
  const providers = [
    { name: "Apple", icon: AppleIcon },
    { name: "Google", icon: GoogleIcon },
    { name: "Meta", icon: MetaIcon },
  ];

  return (
    // pt/pb บวก safe-area — บน Capacitor หน้าเว็บวาดใต้ status bar/แถบ gesture (edge-to-edge)
    // จัดกลางด้วย my-auto ของคอลัมน์แทน justify-center: ตอนคีย์บอร์ดเปิดแล้วเนื้อหาสูงกว่าจอ
    // justify-center ดันหัวการ์ดล้นขึ้นไปใต้ status bar จนเลื่อนกลับมาดูไม่ได้ ส่วน auto margin ไม่ล้น
    <main className="login-light-zone login-layout relative isolate flex min-h-svh flex-col items-center gap-4 bg-muted px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] md:px-10 md:pb-10 md:pt-10">
      {/* Full-screen backdrop, softened so the card and the footer text stay readable. */}
      <Image
        src="/auth/login-hero.png"
        alt=""
        fill
        preload
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-background/50 backdrop-blur-sm" />

      {/* จอเล็กอยู่ในคอลัมน์เหนือการ์ด (absolute เดิมไปทับหัวการ์ดบนมือถือ) — จอกว้างมีที่ว่าง
          มุมขวาบนพอ จึงลอยไว้ที่มุมเหมือนเดิม */}
      <div className="flex w-full max-w-sm justify-end md:absolute md:right-6 md:top-6 md:w-auto md:max-w-none">
        <LanguageSwitch variant="outline" />
      </div>

      <div className="my-auto flex w-full max-w-sm flex-col gap-6 md:max-w-4xl">
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            <form className="p-6 md:p-8" noValidate onSubmit={onSubmit}>
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">{t("auth.welcomeBack")}</h1>
                  <p className="text-balance text-muted-foreground">{t("auth.accessWorkspace")}</p>
                </div>

                <Field>
                  <FieldLabel htmlFor="login-email">{t("auth.email")}</FieldLabel>
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
                    className="login-input text-base md:text-sm"
                    value={email}
                    onBlur={() => setEmail((value) => normalizeLoginEmail(value))}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>

                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="login-password">{t("auth.password")}</FieldLabel>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="ml-auto h-auto p-0"
                      disabled
                      title={t("auth.unavailable")}
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>
                  {/* overflow-hidden clips the input to the group's rounded inner edge: the
                      input is as tall as the bordered group, so Chrome's autofill fill would
                      otherwise paint over the group border and its corners. */}
                  <InputGroup className="overflow-hidden">
                    <InputGroupInput
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      className="text-base md:text-sm"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
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
                <Field orientation="horizontal">
                  <Checkbox
                    id="login-remember"
                    name="remember"
                    checked={remember}
                    onCheckedChange={(checked) => setRemember(checked === true)}
                  />
                  <FieldLabel htmlFor="login-remember" className="font-normal">
                    {t("auth.rememberMe")}
                  </FieldLabel>
                </Field>

                <Field>
                  <Button type="submit" className="login-submit-button" disabled={loading}>
                    {loading ? <Spinner data-icon="inline-start" /> : null}
                    {loading ? t("auth.signingIn") : t("auth.signIn")}
                  </Button>
                </Field>

                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                  {t("auth.orContinueWith")}
                </FieldSeparator>

                <Field className="grid grid-cols-3 gap-4">
                  {providers.map(({ name, icon: Icon }) => (
                    <Button key={name} type="button" variant="outline" disabled title={t("auth.unavailable")}>
                      <Icon />
                      <span className="sr-only">{t("auth.loginWith", { provider: name })}</span>
                    </Button>
                  ))}
                </Field>

                <FieldDescription className="text-center">
                  {t("auth.noAccount")}{" "}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    disabled
                    title={t("auth.unavailable")}
                  >
                    {t("auth.register")}
                  </Button>
                </FieldDescription>
              </FieldGroup>
            </form>

            <div className="relative hidden bg-muted md:block">
              <Image
                src="/auth/login-hero.png"
                alt=""
                fill
                sizes="(min-width: 768px) 28rem, 0px"
                className="object-cover"
              />
            </div>
          </CardContent>
        </Card>

        <FieldDescription className="px-6 text-center">
          {t("auth.agreeToPolicy")} <Link href="/policy">{t("policy.title")}</Link>.{" "}
          {t("auth.version", { version: displayedVersion })}
        </FieldDescription>
      </div>
    </main>
  );
}
