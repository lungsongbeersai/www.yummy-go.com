"use client";

import { Fragment } from "react";
import { usePosOrderAlertListener } from "@/hooks/use-pos-order-alert-listener";
import { useSharedPrinterQueue } from "@/hooks/use-shared-printer-queue";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
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
import { NotificationMenu } from "@/components/layout/notification-menu";
import { menuItemLabel } from "@/components/layout/shell-menu-helpers";
import { type BreadcrumbTrailItem } from "@/components/layout/shell-breadcrumbs";
import { AppSidebar } from "@/components/layout/shell-sidebar-menu";
import { useAppShellData } from "@/components/layout/use-app-shell-data";
import { DisplaySettingsMenu } from "@/components/layout/web/display-settings-menu";
import {
  SidebarStoreHeader,
  SidebarUserMenu,
} from "@/components/layout/web/sidebar-identity";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { i18n, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const runGuardedNavigation = useNavigationGuardStore((state) => state.run);
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

  // Layout follows shadcn's sidebar-07 block: a full-height icon-collapsible sidebar
  // (store in SidebarHeader, user in SidebarFooter) next to a SidebarInset that owns
  // the page header. Capacitor never renders this shell (see protected-shell.tsx).
  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className={cn(
        "app-shell text-foreground",
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
      {!immersiveScreen ? (
        <AppSidebar
          header={<SidebarStoreHeader user={user} />}
          footer={<SidebarUserMenu user={user} logout={() => runGuardedNavigation(logout)} />}
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
        className={cn("min-w-0", fixedDataScreen && "h-full min-h-0 overflow-hidden")}
      >
        {!immersiveScreen ? <AppHeader breadcrumbs={breadcrumbs} /> : null}
        {/* SidebarInset already renders <main>; this is the skip-link target inside it. */}
        <div
          id="app-main-content"
          tabIndex={-1}
          className={cn(
            fixedDataScreen
              ? "min-h-0 w-full flex-1 overflow-hidden"
              : "mx-auto w-full max-w-375 p-4 lg:p-6",
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppHeader({ breadcrumbs }: { breadcrumbs: BreadcrumbTrailItem[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1] ?? {
    title: "dashboard",
  };
  const pageTitle = menuItemLabel(currentBreadcrumb, t);
  // Touch-sized on phones/tablets, compact once a pointer layout has room (a11y floor).
  const controlClassName = "size-11 sm:size-9";

  return (
    <header className="app-header sticky top-0 z-40 flex h-(--app-shell-header-height) shrink-0 items-center gap-2 px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger aria-label={t("app.toggleSidebar")} className={cn("-ml-1", controlClassName)} />
        </TooltipTrigger>
        {/* The shadcn sidebar already binds Ctrl/Cmd+B; surface it for keyboard-heavy cashiers. */}
        <TooltipContent side="bottom">{t("app.toggleSidebar")} (Ctrl+B)</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actions.back")}
            className={controlClassName}
            onClick={() => router.back()}
          >
            <ChevronLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("actions.back")}</TooltipContent>
      </Tooltip>
      <span className="min-w-0 truncate font-medium lg:hidden">{pageTitle}</span>
      <AppBreadcrumb breadcrumbs={breadcrumbs} />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <NotificationMenu triggerClassName={controlClassName} />
        <DisplaySettingsMenu className={controlClassName} />
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
    if (current) {
      return (
        <BreadcrumbPage className="truncate font-semibold text-foreground">
          {title}
        </BreadcrumbPage>
      );
    }
    if (item.disabled || !item.path) {
      return (
        <BreadcrumbPage className="truncate text-muted-foreground">
          {title}
        </BreadcrumbPage>
      );
    }

    return (
      <BreadcrumbLink asChild className="truncate text-muted-foreground">
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
            <BreadcrumbSeparator className="opacity-50" />
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
              <BreadcrumbSeparator className="opacity-50" />
              <BreadcrumbItem className="min-w-0">
                {renderItem(item, false)}
              </BreadcrumbItem>
            </Fragment>
          ))
        )}
        {breadcrumbs.length > 1 && last ? (
          <>
            <BreadcrumbSeparator className="opacity-50" />
            <BreadcrumbItem className="min-w-0">
              {renderItem(last, true)}
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
