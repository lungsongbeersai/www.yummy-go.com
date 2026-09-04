"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
} from "lucide-react";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { MenuIcon } from "@/components/common/menu-icon";
import {
  hasActiveRoute,
  menuItemLabel,
  routeIsActive,
} from "@/components/layout/shell-menu-helpers";
import type { MenuItem } from "@/config/menu";

// ดึงออกมาจาก web/app-shell.tsx เดิม — ใช้ร่วมกันทั้งเว็บเดสก์ท็อป (AppShell) และ
// NativeSideRail (Capacitor แท็บเล็ต/แนวนอน) เพื่อให้เมนูหน้าตาเดียวกันจริง ๆ ไม่ใช่แค่
// copy โค้ดแล้วเผลอหลุด sync กันภายหลัง (ตามที่ขอ — ให้ Capacitor ดูเหมือนเดสก์ท็อป)
export function AppSidebar({
  className,
  error,
  loading,
  menuItems,
  openMenus,
  pathname,
  retry,
  toggleMenu,
}: {
  className?: string;
  error: string | null;
  loading: boolean;
  menuItems: MenuItem[];
  openMenus: Set<string>;
  pathname: string;
  retry: () => void;
  toggleMenu: (title: string) => void;
}) {
  const { t } = useTranslation();
  const { setOpen, setOpenMobile, state } = useSidebar();
  const collapsed = state === "collapsed";

  function closeMobile() {
    setOpenMobile(false);
  }

  function renderLeaf(item: MenuItem) {
    const title = menuItemLabel(item, t);
    const active = routeIsActive(pathname, item.path);
    const icon = <SidebarItemIcon item={item} />;

    return (
      <SidebarMenuItem key={item.path ?? item.title}>
        {item.offlineLocked ? (
          <SidebarMenuButton disabled tooltip={t("offlineMode.lockedMenuTooltip")}>
            {icon}
            {/* collapsed && "hidden" ตรง ๆ แทนพึ่งแค่ truncate+overflow-hidden ของ CSS —
                กันไว้เผื่อบางบริบท (เช่น WebView ของ Capacitor) การคำนวณ overflow ไม่แน่นอน
                display:none รับประกันว่าไม่โผล่แน่นอนไม่ว่า layout จะคำนวณผิดยังไงก็ตาม */}
            <span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>{title}</span>
            {!collapsed ? <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" /> : null}
          </SidebarMenuButton>
        ) : item.disabled || !item.path ? (
          <SidebarMenuButton disabled tooltip={title}>
            {icon}
            <span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>{title}</span>
            {!collapsed ? (
              <Badge variant="secondary" className="ml-auto shrink-0 rounded-full text-2xs">
                {t("nav.coming_soon")}
              </Badge>
            ) : null}
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton asChild isActive={active} tooltip={title}>
            <Link href={internalRoute(item.path)} onClick={closeMobile}>
              {icon}
              <span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>{title}</span>
              {item.badgeText && !collapsed ? (
                <Badge variant="secondary" className="ml-auto max-w-16 shrink-0 truncate" translate="no">
                  {item.badgeText}
                </Badge>
              ) : null}
            </Link>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    );
  }

  function renderChild(item: MenuItem) {
    const title = menuItemLabel(item, t);
    const active = routeIsActive(pathname, item.path);

    return (
      <SidebarMenuSubItem key={item.path ?? item.title}>
        {item.offlineLocked ? (
          <SidebarMenuSubButton
            aria-disabled
            title={t("offlineMode.lockedMenuTooltip")}
            className="pointer-events-none opacity-50"
          >
            <span>{title}</span>
            <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          </SidebarMenuSubButton>
        ) : item.disabled || !item.path ? (
          <SidebarMenuSubButton
            aria-disabled
            className="pointer-events-none opacity-50"
          >
            <span>{title}</span>
            <Badge className="ml-auto rounded-full text-2xs">
              {t("nav.coming_soon")}
            </Badge>
          </SidebarMenuSubButton>
        ) : (
          <SidebarMenuSubButton asChild isActive={active}>
            <Link href={internalRoute(item.path)} onClick={closeMobile}>
              <span>{title}</span>
            </Link>
          </SidebarMenuSubButton>
        )}
      </SidebarMenuSubItem>
    );
  }

  function renderDropdownChild(item: MenuItem) {
    const title = menuItemLabel(item, t);

    if (item.offlineLocked) {
      return (
        <DropdownMenuItem key={item.title} disabled>
          {title}
          <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuItem>
      );
    }

    if (item.disabled || !item.path) {
      return (
        <DropdownMenuItem key={item.title} disabled>
          {title}
        </DropdownMenuItem>
      );
    }

    return (
      <DropdownMenuItem key={item.path} asChild>
        <Link href={internalRoute(item.path)} onClick={closeMobile}>
          {title}
        </Link>
      </DropdownMenuItem>
    );
  }

  function renderItem(item: MenuItem) {
    if (item.is_header) {
      return (
        <SidebarGroupLabel key={item.title}>
          {menuItemLabel(item, t)}
        </SidebarGroupLabel>
      );
    }

    if (!item.children?.length) return renderLeaf(item);

    const title = menuItemLabel(item, t);
    const active = hasActiveRoute(item, pathname);
    const open = openMenus.has(item.title);
    const icon = <SidebarItemIcon item={item} />;

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
                {icon}
                {/* branch นี้เข้าได้เฉพาะตอน collapsed=true เท่านั้น (เช็คไว้ก่อนแล้วด้านบน) —
                    ซ่อน span นี้ตรง ๆ ด้วย hidden เลยแทนพึ่ง truncate+overflow-hidden ของ CSS
                    (เคยลองแบบนั้นมาแล้วยังโผล่อยู่ดี — ดู tooltip prop ด้านล่างสำหรับข้อความชื่อเมนู
                    ตอน hover/focus แทน) */}
                <span className="sr-only">{title}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0.5 right-0.5 size-3 rounded-full bg-sidebar p-0.5 text-sidebar-primary"
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
          {icon}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {item.badgeText ? (
            <Badge variant="secondary" className="ml-auto max-w-16 shrink-0 truncate" translate="no">
              {item.badgeText}
            </Badge>
          ) : null}
          <ChevronDown
            className={cn(
              "shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </SidebarMenuButton>
        {open ? (
          <SidebarMenuSub>
            {item.children.map((child) => (
              <Fragment key={child.path ?? child.title}>
                {renderChild(child)}
              </Fragment>
            ))}
          </SidebarMenuSub>
        ) : null}
      </SidebarMenuItem>
    );
  }

  const hasItems = menuItems.length > 0;

  return (
    <Sidebar collapsible="icon" className={className}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {hasItems ? (
              <SidebarMenu>
                {menuItems.map((item) => renderItem(item))}
              </SidebarMenu>
            ) : loading ? (
              <div
                role="status"
                aria-label={t("app.menuLoading")}
                className="flex flex-col gap-2 p-2"
              >
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton
                    key={index}
                    className={cn(
                      "h-8 rounded-md",
                      collapsed ? "w-8" : "w-full",
                    )}
                  />
                ))}
              </div>
            ) : (
              <div
                role={error ? "alert" : "status"}
                className={cn(
                  "m-2 flex flex-col items-center gap-2 rounded-md border border-dashed p-3 text-center",
                  collapsed && "p-1",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-medium text-muted-foreground",
                    collapsed && "sr-only",
                  )}
                >
                  {t("app.menuUnavailable")}
                </p>
                {error && !collapsed ? (
                  <p className="line-clamp-2 text-2xs text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size={collapsed ? "icon" : "sm"}
                  aria-label={t("app.retryMenu")}
                  onClick={retry}
                >
                  <RefreshCw />
                  <span className={cn(collapsed && "sr-only")}>
                    {t("app.retryMenu")}
                  </span>
                </Button>
              </div>
            )}
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
              <span>
                {collapsed ? t("app.expandSidebar") : t("app.collapseSidebar")}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function SidebarItemIcon({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  if (Icon) return <Icon />;
  if (item.iconName) return <MenuIcon value={item.iconName} />;
  return null;
}
