"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MenuIcon } from "@/components/common/menu-icon";
import { NativeRouteProgress } from "@/components/layout/capacitor/route-progress";
import { menuItemLabel } from "@/components/layout/shell-menu-helpers";
import {
  isDestinationActive,
  type NativeDestination,
  type NativeNavigationModel,
} from "@/components/layout/native-navigation-model";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/config/menu";

function DestinationIcon({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  if (Icon) return <Icon className="size-5 shrink-0" />;
  if (item.iconName) return <MenuIcon value={item.iconName} className="size-5 shrink-0" />;
  return null;
}

// ปุ่มเดียวใช้ทั้ง bottom bar และ side rail — label อยู่ใต้ไอคอนเหมือนกันทั้งคู่
export function NavDestinationButton({
  active,
  destination,
}: {
  active: boolean;
  destination: NativeDestination;
}) {
  const { t } = useTranslation();
  const label = menuItemLabel(destination.item, t);

  return (
    <Link
      href={internalRoute(destination.path)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-12 min-w-0 flex-none flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <DestinationIcon item={destination.item} />
      <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">
        {label}
      </span>
      <NativeRouteProgress />
    </Link>
  );
}

export function NavMoreButton({
  active,
  icon,
  label,
  moreOpen,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  moreOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      // active รวมสถานะ "ไม่มี direct ไหน active" ไว้ด้วย จึงใช้แทน aria-expanded ไม่ได้
      aria-expanded={moreOpen}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex min-h-12 min-w-0 flex-none flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">
        {label}
      </span>
    </button>
  );
}

// รายการปุ่ม nav ที่ใช้ร่วมกันทั้ง bottom bar และ side rail — เหลือแค่ <nav> wrapper ที่ต่างกันใน caller แต่ละตัว
export function NativeNavItems({
  error,
  loading,
  model,
  moreOpen,
  onMoreClick,
  onRetry,
  pathname,
}: {
  error: string | null;
  loading: boolean;
  model: NativeNavigationModel;
  moreOpen: boolean;
  onMoreClick: () => void;
  onRetry: () => void;
  pathname: string;
}) {
  const { t } = useTranslation();
  const hasItems = model.direct.length > 0 || model.more.length > 0;

  // เมนูมาจาก permission API — ระหว่างรอ/เมื่อพัง ยังไม่มีปลายทางให้กดสักปุ่ม
  // ถ้าไม่แสดงอะไรเลยผู้ใช้จะติดอยู่หน้าปัจจุบันโดยไม่มีทางออกและไม่รู้ว่าต้องรอหรือกดใหม่
  if (!hasItems && loading) {
    return (
      <div
        role="status"
        aria-label={t("app.menuLoading")}
        className="flex flex-1 items-center gap-1 md:flex-col md:items-stretch"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-10 flex-1 rounded-md md:flex-none" />
        ))}
      </div>
    );
  }

  if (!hasItems && error) {
    return (
      <div
        role="alert"
        className="flex flex-1 items-center justify-center md:flex-none"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("app.retryMenu")}
          title={t("app.menuUnavailable")}
          className="size-12 text-destructive"
          onClick={onRetry}
        >
          <RefreshCw />
        </Button>
      </div>
    );
  }

  const anyDirectActive = model.direct.some((destination) =>
    isDestinationActive(destination, pathname),
  );

  return (
    <>
      {model.direct.map((destination) => (
        <NavDestinationButton
          key={destination.path}
          active={isDestinationActive(destination, pathname)}
          destination={destination}
        />
      ))}
      {model.more.length ? (
        <NavMoreButton
          active={moreOpen || !anyDirectActive}
          icon={<MoreHorizontal className="size-5 shrink-0" />}
          label={t("app.more")}
          moreOpen={moreOpen}
          onClick={onMoreClick}
        />
      ) : null}
    </>
  );
}
