"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { MenuIcon } from "@/components/common/menu-icon";
import { menuItemLabel } from "@/components/layout/shell-menu-helpers";
import type { NativeDestination } from "@/components/layout/native-navigation-model";
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
        "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <DestinationIcon item={destination.item} />
      <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">
        {label}
      </span>
    </Link>
  );
}

export function NavMoreButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
