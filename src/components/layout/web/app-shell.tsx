"use client";

import { Fragment } from "react";
import { usePosOrderAlertListener } from "@/hooks/use-pos-order-alert-listener";
import { useSharedPrinterQueue } from "@/hooks/use-shared-printer-queue";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronLeft,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserPen,
} from "lucide-react";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { FloatingSettingsButton } from "@/components/layout/floating-settings-button";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  menuItemLabel,
  userInitials,
} from "@/components/layout/shell-menu-helpers";
import { type BreadcrumbTrailItem } from "@/components/layout/shell-breadcrumbs";
import { AppSidebar } from "@/components/layout/shell-sidebar-menu";
import { useAppShellData } from "@/components/layout/use-app-shell-data";
import { getStoreLogoUrl, getUserProfileUrl } from "@/lib/image";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { i18n, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const collapsed = useAppStore((state) => state.collapsed);
  const setCollapsed = useAppStore((state) => state.setCollapsed);
  usePosOrderAlertListener({ branchUuid: user?.branch_uuid, language: i18n.language });
  useSharedPrinterQueue();
  const {
    breadcrumbs,
    dashboardScreen,
    fixedDataScreen,
    immersiveScreen,
    menuError,
    menuItems,
    menuLoading,
    openMenus,
    pathname,
    retrySidebarMenu,
    toggleMenu,
  } = useAppShellData();
  // scroll-lock, pos-android-system-screen และสถานะกลุ่มเมนูหด/กาง (openMenus/toggleMenu)
  // ย้ายไปอยู่ใน useAppShellData แล้ว เพื่อให้ shell ทั้งสองฝั่งได้พฤติกรรมเดียวกันโดยไม่ต้อง
  // คัดลอก effect/state ซ้ำ (NativeSideRail ใช้ AppSidebar ตัวเดียวกันนี้แล้วด้วย)

  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className={cn(
        "app-shell flex-col text-foreground",
        fixedDataScreen
          ? immersiveScreen
            ? "h-dvh overflow-hidden"
            : "h-screen overflow-hidden"
          : "min-h-screen",
      )}
      data-fixed-screen={fixedDataScreen ? "true" : "false"}
      data-dashboard-screen={dashboardScreen ? "true" : "false"}
      data-sidebar-state={collapsed ? "collapsed" : "expanded"}
    >
      <a
        href="#app-main-content"
        className="fixed left-2 top-2 z-100 -translate-y-24 rounded-md bg-background px-4 py-3 font-bold text-foreground shadow-lg transition-transform focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("app.skipToContent")}
      </a>
      <FloatingSettingsButton />
      {!immersiveScreen ? (
        <AppHeader
          breadcrumbs={breadcrumbs}
          collapsed={collapsed}
          logout={logout}
          user={user}
        />
      ) : null}
      <div
        className={cn(
          "app-shell-body flex min-h-0 w-full flex-1",
          dashboardScreen && !fixedDataScreen
            ? "overflow-visible"
            : "overflow-hidden",
        )}
      >
        {!immersiveScreen ? (
          <AppSidebar
            className="app-sidebar-panel top-(--app-shell-header-height) h-[calc(100svh-var(--app-shell-header-height))] border-r border-sidebar-border"
            error={menuError}
            loading={menuLoading}
            menuItems={menuItems}
            openMenus={openMenus}
            pathname={pathname}
            retry={retrySidebarMenu}
            toggleMenu={toggleMenu}
          />
        ) : null}
        <SidebarInset
          className={cn(
            "min-w-0",
            fixedDataScreen ? "h-full overflow-hidden" : "min-h-0",
          )}
        >
          <main
            id="app-main-content"
            tabIndex={-1}
            className={cn(
              fixedDataScreen
                ? "h-full min-h-0 min-w-0 w-full max-w-none overflow-hidden"
                : "mx-auto w-full max-w-375 p-4 lg:p-6",
            )}
          >
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppHeader({
  breadcrumbs,
  collapsed,
  logout,
  user,
}: {
  breadcrumbs: BreadcrumbTrailItem[];
  collapsed: boolean;
  logout: () => void;
  user: AuthUser | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const isCapacitorNativeApp = useIsCapacitorNativeApp();
  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1] ?? {
    title: "dashboard",
  };
  const pageTitle = menuItemLabel(currentBreadcrumb, t);
  const logoSrc = user?.store_logo
    ? getStoreLogoUrl(user.store_logo)
    : "/brand/icon.png";
  const profileSrc = user?.profile ? getUserProfileUrl(user.profile) : "";
  const branchTitle = user?.branch_name || user?.store_name || "Yummy Go";
  const address =
    user?.branch_address || user?.store_name || t("app.posWorkspace");

  return (
    <header className="app-header sticky top-0 z-40 flex h-(--app-shell-header-height) w-full items-center justify-between gap-2 border-b border-border px-2 sm:px-4 lg:gap-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/"
              title={`${branchTitle} - ${address}`}
              className={cn(
                "hidden min-w-0 shrink-0 items-center md:flex",
                collapsed
                  ? "w-(--sidebar-width-icon) max-w-(--sidebar-width-icon) justify-center"
                  : "w-(--sidebar-width) max-w-(--sidebar-width) gap-3",
              )}
            >
              <Avatar className="size-12.5 shrink-0 rounded-md">
                <AvatarImage src={logoSrc} alt={branchTitle} />
                <AvatarFallback className="rounded-md font-black">
                  {userInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "min-w-0 flex-1 flex-col overflow-hidden",
                  collapsed ? "hidden" : "hidden sm:flex",
                )}
              >
                <span className="truncate text-base font-black text-primary">
                  {branchTitle}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {address}
                </span>
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-96">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-bold">{branchTitle}</span>
              <span className="wrap-break-word text-xs leading-5 opacity-80">
                {address}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="hidden h-12 md:block" />

        <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger
                aria-label={t("app.openMenu")}
                className="size-11 shrink-0 sm:size-9 md:hidden"
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("app.openMenu")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="size-11 shrink-0 text-primary sm:size-9 md:hidden"
                aria-label={t("actions.back")}
                onClick={() => router.back()}
              >
                <ChevronLeft data-icon="inline-start" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("actions.back")}</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            variant="ghost"
            className="hidden h-10 gap-2 px-2 text-primary md:inline-flex"
            onClick={() => router.back()}
          >
            <ChevronLeft data-icon="inline-start" />
            {t("actions.back")}
          </Button>
          <span className="min-w-0 truncate text-sm font-bold md:hidden">
            {pageTitle}
          </span>
          <span className="hidden truncate text-sm text-muted-foreground md:block lg:hidden">
            {pageTitle}
          </span>
          <AppBreadcrumb breadcrumbs={breadcrumbs} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {isCapacitorNativeApp ? (
          // Capacitor ไม่มี pull-to-refresh/ปุ่ม reload ของเบราว์เซอร์ให้ผู้ใช้ ต้องมีทางรีโหลด
          // เอง โดยเฉพาะช่วง dev ที่ server.url ชี้ dev server ในเครื่อง
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="size-11 shrink-0 sm:size-9"
                aria-label={t("app.refreshApp")}
                onClick={() => window.location.reload()}
              >
                <RefreshCw />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("app.refreshApp")}</TooltipContent>
          </Tooltip>
        ) : null}
        <ThemeToggle variant="ghost" className="size-11 sm:size-9" />
        <NotificationMenu triggerClassName="size-11 sm:size-9" />
        <LanguageSwitch compact size="icon" className="size-11 sm:size-9" />
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={user?.email ?? t("profile.sections.account")}
                  className="h-11 min-w-11 gap-2 px-0 sm:h-10 sm:min-w-10 sm:px-2"
                >
                  <Avatar className="size-9">
                    {profileSrc ? (
                      <AvatarImage
                        src={profileSrc}
                        alt={user?.email ?? "Profile"}
                      />
                    ) : null}
                    <AvatarFallback>{userInitials(user)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-52 truncate font-bold xl:inline">
                    {user?.email ?? t("profile.sections.account")}
                  </span>
                  <ChevronDown className="hidden sm:block" data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>{user?.email ?? t("profile.sections.account")}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">
              {user?.email ?? t("profile.sections.account")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserPen />
                {t("actions.editProfile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/policy">
                <ShieldCheck />
                {t("policy.title")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={logout}>
              <LogOut />
              {t("actions.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function AppBreadcrumb({
  breadcrumbs,
}: {
  breadcrumbs: BreadcrumbTrailItem[];
}) {
  const { t } = useTranslation();
  const first = breadcrumbs[0];
  const last = breadcrumbs[breadcrumbs.length - 1];
  const middle = breadcrumbs.slice(1, -1);
  const overflow = middle.length > 1;

  function renderItem(item: BreadcrumbTrailItem, current: boolean) {
    const title = menuItemLabel(item, t);
    if (current || item.disabled || !item.path) {
      return (
        <BreadcrumbPage className="truncate font-semibold">
          {title}
        </BreadcrumbPage>
      );
    }

    return (
      <BreadcrumbLink asChild className="truncate">
        <Link href={internalRoute(item.path)}>{title}</Link>
      </BreadcrumbLink>
    );
  }

  return (
    <Breadcrumb
      aria-label={t("app.breadcrumbs")}
      className="hidden min-w-0 text-sm lg:block"
    >
      <BreadcrumbList className="gap-1.5">
        {first ? (
          <BreadcrumbItem className="min-w-0">
            {renderItem(first, breadcrumbs.length === 1)}
          </BreadcrumbItem>
        ) : null}
        {overflow ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("app.breadcrumbs")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <BreadcrumbEllipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {middle.map((item) => {
                    const title = menuItemLabel(item, t);
                    if (item.disabled || !item.path) {
                      return (
                        <DropdownMenuItem
                          key={`${item.title}-disabled`}
                          disabled
                        >
                          {title}
                        </DropdownMenuItem>
                      );
                    }
                    return (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link href={internalRoute(item.path)}>{title}</Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
          </>
        ) : (
          middle.map((item) => (
            <Fragment key={item.path ?? item.title}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {renderItem(item, false)}
              </BreadcrumbItem>
            </Fragment>
          ))
        )}
        {breadcrumbs.length > 1 && last ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              {renderItem(last, true)}
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
