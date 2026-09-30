"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChevronLeft, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { DisplaySettingsMenu } from "@/components/layout/web/display-settings-menu";
import { menuItemLabel } from "@/components/layout/shell-menu-helpers";
import type { BreadcrumbTrailItem } from "@/components/layout/shell-breadcrumbs";
import { useAppStore } from "@/stores/app-store";

export function Swan1HomeTopBar({ breadcrumbs }: { breadcrumbs: BreadcrumbTrailItem[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const collapsed = useAppStore((state) => state.collapsed);
  const setCollapsed = useAppStore((state) => state.setCollapsed);
  const title = menuItemLabel(breadcrumbs[breadcrumbs.length - 1] ?? { title: "dashboard" }, t);

  return (
    <header className="swan1-home-top-bar app-header sticky top-0 z-40 flex shrink-0 items-center gap-2 px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={t("app.toggleSidebar")}
        aria-pressed={!collapsed}
        onClick={() => setCollapsed(!collapsed)}
      >
        <PanelLeft />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={t("actions.back")}
        onClick={() => router.back()}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-0 truncate font-semibold">{title}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <LanguageSwitch compact size="icon" className="size-11" />
        <NotificationMenu triggerClassName="size-11" />
        <DisplaySettingsMenu className="size-11" />
      </div>
    </header>
  );
}
