"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserPen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import sideMenu, { type MenuItem } from "@/config/menu";
import { routeBreadcrumbs, type RouteBreadcrumbItem } from "@/config/route-breadcrumbs";
import { getStoreLogoUrl } from "@/services/store";
import { getUserProfileUrl } from "@/services/user";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

type BreadcrumbTrailItem = RouteBreadcrumbItem;

const POS_ANDROID_SYSTEM_SCREEN_CLASS = "pos-android-system-screen";

function menuKey(title: string) {
  return `nav.${title}`;
}

function isAllowed(item: MenuItem, userStatus?: number) {
  if (!item.allowedStatus?.length) return true;
  return typeof userStatus === "number" && item.allowedStatus.includes(userStatus);
}

function filterMenu(items: MenuItem[], userStatus?: number): MenuItem[] {
  return items.flatMap((item) => {
    if (!isAllowed(item, userStatus)) return [];
    if (!item.children?.length) return [item];
    return [{ ...item, children: filterMenu(item.children, userStatus) }];
  });
}

function isExactRoute(pathname: string, path?: string) {
  return Boolean(path && pathname === path);
}

function routeIsActive(pathname: string, path?: string) {
  if (!path) return false;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function hasActiveRoute(item: MenuItem, pathname: string): boolean {
  if (routeIsActive(pathname, item.path)) return true;
  return item.children?.some((child) => hasActiveRoute(child, pathname)) ?? false;
}

function activeMenuTitles(items: MenuItem[], pathname: string): string[] {
  return items.flatMap((item) => {
    if (!item.children?.length || !hasActiveRoute(item, pathname)) return [];
    return [item.title, ...activeMenuTitles(item.children, pathname)];
  });
}

function findBreadcrumbs(
  items: MenuItem[],
  pathname: string,
  trail: BreadcrumbTrailItem[] = []
): BreadcrumbTrailItem[] | null {
  for (const item of items) {
    if (item.is_header) continue;
    const nextTrail = [...trail, { disabled: item.disabled, path: item.path, title: item.title }];
    if (isExactRoute(pathname, item.path)) return nextTrail;
    if (item.children?.length) {
      const match = findBreadcrumbs(item.children, pathname, nextTrail);
      if (match) return match;
    }
  }
  return null;
}

function resolveBreadcrumbs(items: MenuItem[], pathname: string): BreadcrumbTrailItem[] | null {
  const routeTrail = routeBreadcrumbs[pathname];
  if (routeTrail) return routeTrail;

  const exact = findBreadcrumbs(items, pathname);
  if (exact) return exact;

  const segments = pathname.split("/").filter(Boolean);
  for (let i = segments.length - 1; i > 0; i -= 1) {
    const ancestor = "/" + segments.slice(0, i).join("/");
    const match = findBreadcrumbs(items, ancestor);
    if (match) return match;
  }
  return null;
}

function userInitials(user: AuthUser | null) {
  const source = user?.store_name || user?.branch_name || user?.email || "YG";
  return source
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "YG";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const collapsed = useAppStore((state) => state.collapsed);
  const setCollapsed = useAppStore((state) => state.setCollapsed);
  const menuItems = useMemo(() => filterMenu(sideMenu, user?.status), [user?.status]);
  const breadcrumbs = useMemo(() => {
    const home: BreadcrumbTrailItem = { path: "/", title: "dashboard" };
    const trail = resolveBreadcrumbs(menuItems, pathname);
    if (!trail) return [home];
    if (trail[0]?.path === "/") return trail;
    return [home, ...trail];
  }, [menuItems, pathname]);
  const immersiveScreen = pathname === "/sales/open-table-sale" || pathname === "/sale/order-customer";
  const fixedDataScreen = immersiveScreen || pathname.startsWith("/setting/") || pathname === "/permission-store" || pathname === "/printer" || pathname === "/product" || pathname === "/report/daily-sales" || pathname === "/report/best-selling-products" || pathname === "/report/payment-methods" || pathname === "/sales/sales-list" || pathname === "/sales/cancel-history";
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => new Set(activeMenuTitles(menuItems, pathname)));

  useEffect(() => {
    if (!fixedDataScreen) return;
    document.documentElement.classList.add("data-screen-scroll-lock");
    document.body.classList.add("data-screen-scroll-lock");

    return () => {
      document.documentElement.classList.remove("data-screen-scroll-lock");
      document.body.classList.remove("data-screen-scroll-lock");
    };
  }, [fixedDataScreen]);

  useEffect(() => {
    const isAndroid = /android/i.test(window.navigator.userAgent);
    const shouldReserveAndroidSystemBar = immersiveScreen && isAndroid;
    const root = document.documentElement;
    const body = document.body;

    if (shouldReserveAndroidSystemBar) {
      root.classList.add(POS_ANDROID_SYSTEM_SCREEN_CLASS);
      body.classList.add(POS_ANDROID_SYSTEM_SCREEN_CLASS);
    } else {
      root.classList.remove(POS_ANDROID_SYSTEM_SCREEN_CLASS);
      body.classList.remove(POS_ANDROID_SYSTEM_SCREEN_CLASS);
    }

    return () => {
      root.classList.remove(POS_ANDROID_SYSTEM_SCREEN_CLASS);
      body.classList.remove(POS_ANDROID_SYSTEM_SCREEN_CLASS);
    };
  }, [immersiveScreen]);

  useEffect(() => {
    const activeTitles = activeMenuTitles(menuItems, pathname);
    if (!activeTitles.length) return;
    setOpenMenus((current) => {
      const next = new Set(current);
      activeTitles.forEach((title) => next.add(title));
      return next;
    });
  }, [menuItems, pathname]);

  function toggleMenu(title: string) {
    setOpenMenus((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className={cn(
        "app-shell flex-col text-foreground",
        fixedDataScreen
          ? immersiveScreen
            ? "h-[100dvh] overflow-hidden"
            : "h-screen overflow-hidden"
          : "min-h-screen"
      )}
      data-fixed-screen={fixedDataScreen ? "true" : "false"}
      data-sidebar-state={collapsed ? "collapsed" : "expanded"}
    >
      {!immersiveScreen ? <AppHeader breadcrumbs={breadcrumbs} logout={logout} user={user} /> : null}
      <div className="app-shell-body flex min-h-0 w-full flex-1 overflow-hidden">
        {!immersiveScreen ? (
          <AppSidebar
            menuItems={menuItems}
            openMenus={openMenus}
            pathname={pathname}
            toggleMenu={toggleMenu}
          />
        ) : null}
        <SidebarInset className={cn(fixedDataScreen ? "h-full overflow-hidden" : "min-h-0")}>
          <main
            className={cn(
              fixedDataScreen
                ? "h-full min-h-0 w-full max-w-none overflow-hidden"
                : "mx-auto w-full max-w-[1500px] p-4 lg:p-6"
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
  logout,
  user
}: {
  breadcrumbs: BreadcrumbTrailItem[];
  logout: () => void;
  user: AuthUser | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pageTitle = t(menuKey(breadcrumbs[breadcrumbs.length - 1]?.title ?? "dashboard"));
  const logoSrc = user?.store_logo ? getStoreLogoUrl(user.store_logo) : "/brand/icon.png";
  const profileSrc = user?.profile ? getUserProfileUrl(user.profile) : "";
  const branchTitle = user?.branch_name || user?.store_name || "Yummy Go";
  const address = user?.branch_address || user?.store_name || t("app.posWorkspace");

  return (
    <header className="app-header sticky top-0 z-40 flex h-[var(--app-shell-header-height)] w-full items-center justify-between gap-2 border-b border-border px-2 sm:px-4 lg:gap-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
        <Link href="/" className="hidden min-w-0 items-center gap-3 md:flex">
          <Avatar className="size-[50px] rounded-md">
            <AvatarImage src={logoSrc} alt={branchTitle} />
            <AvatarFallback className="rounded-md font-black">{userInitials(user)}</AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-base font-black text-primary">{branchTitle}</span>
            <span className="truncate text-xs text-muted-foreground">{address}</span>
          </div>
        </Link>

        <Separator orientation="vertical" className="hidden h-12 md:block" />

        <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger aria-label={t("app.openMenu")} className="shrink-0 md:hidden" />
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("app.openMenu")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-primary md:hidden"
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
          <span className="min-w-0 truncate text-sm font-bold md:hidden">{pageTitle}</span>
          <span className="hidden truncate text-sm text-muted-foreground md:block lg:hidden">{pageTitle}</span>
          <AppBreadcrumb breadcrumbs={breadcrumbs} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <ThemeToggle variant="ghost" />
        <NotificationMenu />
        <LanguageSwitch />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 min-w-10 gap-2 px-0 sm:px-2">
              <Avatar className="size-9">
                {profileSrc ? <AvatarImage src={profileSrc} alt={user?.email ?? "Profile"} /> : null}
                <AvatarFallback>{userInitials(user)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-28 truncate font-bold lg:inline">{t("common.actions")}</span>
              <ChevronDown className="hidden sm:block" data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user?.email ?? t("settings.modules.user.title")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserPen />
                {t("actions.editProfile")}
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

function AppSidebar({
  menuItems,
  openMenus,
  pathname,
  toggleMenu
}: {
  menuItems: MenuItem[];
  openMenus: Set<string>;
  pathname: string;
  toggleMenu: (title: string) => void;
}) {
  const { t } = useTranslation();
  const { setOpen, setOpenMobile, state } = useSidebar();
  const collapsed = state === "collapsed";

  function closeMobile() {
    setOpenMobile(false);
  }

  function renderLeaf(item: MenuItem) {
    const title = t(menuKey(item.title));
    const active = routeIsActive(pathname, item.path);
    const Icon = item.icon;

    return (
      <SidebarMenuItem key={item.path ?? item.title}>
        {item.disabled || !item.path ? (
          <SidebarMenuButton disabled tooltip={title}>
            {Icon ? <Icon /> : null}
            <span>{title}</span>
            {!collapsed ? <SidebarMenuBadge>{t("nav.coming_soon")}</SidebarMenuBadge> : null}
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton asChild isActive={active} tooltip={title}>
            <Link href={item.path} onClick={closeMobile}>
              {Icon ? <Icon /> : null}
              <span>{title}</span>
            </Link>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    );
  }

  function renderChild(item: MenuItem) {
    const title = t(menuKey(item.title));
    const active = routeIsActive(pathname, item.path);

    return (
      <SidebarMenuSubItem key={item.path ?? item.title}>
        {item.disabled || !item.path ? (
          <SidebarMenuSubButton aria-disabled className="pointer-events-none opacity-50">
            <span>{title}</span>
            <Badge className="ml-auto rounded-full text-[10px]">
              {t("nav.coming_soon")}
            </Badge>
          </SidebarMenuSubButton>
        ) : (
          <SidebarMenuSubButton asChild isActive={active}>
            <Link href={item.path} onClick={closeMobile}>
              <span>{title}</span>
            </Link>
          </SidebarMenuSubButton>
        )}
      </SidebarMenuSubItem>
    );
  }

  function renderDropdownChild(item: MenuItem) {
    const title = t(menuKey(item.title));

    if (item.disabled || !item.path) {
      return (
        <DropdownMenuItem key={item.title} disabled>
          {title}
        </DropdownMenuItem>
      );
    }

    return (
      <DropdownMenuItem key={item.path} asChild>
        <Link href={item.path} onClick={closeMobile}>
          {title}
        </Link>
      </DropdownMenuItem>
    );
  }

  function renderItem(item: MenuItem) {
    if (item.is_header) {
      return (
        <SidebarGroupLabel key={item.title}>
          {t(menuKey(item.title))}
        </SidebarGroupLabel>
      );
    }

    if (!item.children?.length) return renderLeaf(item);

    const title = t(menuKey(item.title));
    const active = hasActiveRoute(item, pathname);
    const open = openMenus.has(item.title);
    const Icon = item.icon;

    if (collapsed) {
      return (
        <SidebarMenuItem key={item.title}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                aria-haspopup="menu"
                className="relative"
                isActive={active}
                tooltip={title}
              >
                {Icon ? <Icon /> : null}
                <span>{title}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="sidebar-submenu-cue pointer-events-none absolute right-0.5 top-1/2 size-3 -translate-y-1/2 rounded-full border"
                />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-60">
              <DropdownMenuLabel>{title}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.children.map((child) => renderDropdownChild(child))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          type="button"
          isActive={active}
          onClick={() => toggleMenu(item.title)}
        >
          {Icon ? <Icon /> : null}
          <span>{title}</span>
          <ChevronDown className={cn("ml-auto transition-transform", open && "rotate-180")} />
        </SidebarMenuButton>
        {open ? (
          <SidebarMenuSub>
            {item.children.map((child) => (
              <Fragment key={child.path ?? child.title}>{renderChild(child)}</Fragment>
            ))}
          </SidebarMenuSub>
        ) : null}
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar collapsible="icon" className="app-sidebar-panel border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{menuItems.map((item) => renderItem(item))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="hidden border-t border-sidebar-border md:flex">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              tooltip={collapsed ? t("app.expandSidebar") : undefined}
              onClick={() => setOpen(collapsed)}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              <span>{collapsed ? t("app.expandSidebar") : t("app.collapseSidebar")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function AppBreadcrumb({ breadcrumbs }: { breadcrumbs: BreadcrumbTrailItem[] }) {
  const { t } = useTranslation();
  const first = breadcrumbs[0];
  const last = breadcrumbs[breadcrumbs.length - 1];
  const middle = breadcrumbs.slice(1, -1);
  const overflow = middle.length > 1;

  function renderItem(item: BreadcrumbTrailItem, current: boolean) {
    const title = t(menuKey(item.title));
    if (current || item.disabled || !item.path) {
      return <BreadcrumbPage className="truncate font-semibold">{title}</BreadcrumbPage>;
    }

    return (
      <BreadcrumbLink asChild className="truncate">
        <Link href={item.path}>{title}</Link>
      </BreadcrumbLink>
    );
  }

  return (
    <Breadcrumb aria-label={t("app.breadcrumbs")} className="hidden min-w-0 text-sm lg:block">
      <BreadcrumbList className="gap-1.5">
        {first ? <BreadcrumbItem className="min-w-0">{renderItem(first, breadcrumbs.length === 1)}</BreadcrumbItem> : null}
        {overflow ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t("app.breadcrumbs")}
                  className="flex items-center justify-center rounded-md p-1 hover:text-foreground"
                >
                  <BreadcrumbEllipsis className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {middle.map((item) => {
                    const title = t(menuKey(item.title));
                    if (item.disabled || !item.path) {
                      return (
                        <DropdownMenuItem key={`${item.title}-disabled`} disabled>
                          {title}
                        </DropdownMenuItem>
                      );
                    }
                    return (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link href={item.path}>{title}</Link>
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
              <BreadcrumbItem className="min-w-0">{renderItem(item, false)}</BreadcrumbItem>
            </Fragment>
          ))
        )}
        {breadcrumbs.length > 1 && last ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">{renderItem(last, true)}</BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
