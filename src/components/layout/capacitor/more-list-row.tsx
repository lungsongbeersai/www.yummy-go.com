"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { DestinationIcon } from "@/components/layout/capacitor/nav-destination-button";
import { NativeRouteProgress } from "@/components/layout/capacitor/route-progress";
import { menuItemLabel, routeIsActive } from "@/components/layout/shell-menu-helpers";
import type { MenuItem } from "@/config/menu";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";

// ตรงกับ sidebar ฝั่งเว็บ (web/app-shell.tsx renderItem): มีลูก = เป็นกลุ่มเสมอ ไม่สน
// ว่า item.path ของกลุ่มจะมีหน้าเพจจริงรองรับหรือไม่ (เช่น "ตั้งค่า" ก็เปิดกลุ่มแทนการพาไปหน้า
// hub /settings) — path ของตัวลูกแต่ละอันต่างหากที่ใช้ navigate จริง
export function needsMoreGroupDropdown(item: MenuItem): boolean {
  return Boolean(item.children?.length);
}

// Native list anatomy (Android Settings / Material 3 list item): full-width rows, no borders or
// dividers, a 40px round tinted icon, a 16px label with an optional one-line summary, and a
// pressed tint instead of a hover. Rows are 64px tall; the pressed tint bleeds to the screen
// edge (-mx-3 undoes the shell's px-3) the way a ripple does.
const ROW_CLASS =
  "relative -mx-3 flex min-h-16 items-center gap-4 px-4 py-2 text-left transition-colors duration-150 select-none active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none";

function RowIcon({ active = false, item }: { active?: boolean; item: MenuItem }) {
  const hasIcon = Boolean(item.icon || item.iconName);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary-text",
      )}
    >
      {/* Items without an icon of their own (a child pulled up from a group) get a neutral one,
          so every row keeps the same shape. */}
      {hasIcon ? <DestinationIcon className="size-5 shrink-0" item={item} /> : <LayoutGrid className="size-5" />}
    </span>
  );
}

function RowText({ active = false, label, summary }: { active?: boolean; label: string; summary?: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={cn("truncate text-base", active ? "font-semibold text-primary-text" : "font-medium text-foreground")}>
        {label}
      </span>
      {summary ? <span className="truncate text-[13px] text-muted-foreground">{summary}</span> : null}
    </span>
  );
}

export function MoreListRow({
  item,
  nested = false,
  pathname,
  onNavigate,
}: {
  item: MenuItem;
  /** A row inside a group's bottom sheet: no icon circle, the label alone, 56px tall. */
  nested?: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const label = menuItemLabel(item, t);
  const href = item.path;
  const active = routeIsActive(pathname, item.path);

  if (item.disabled || !href) {
    return (
      <span aria-disabled="true" className={cn(ROW_CLASS, nested ? "min-h-14" : "", "opacity-50 active:bg-transparent")}>
        {nested ? null : <RowIcon item={item} />}
        <RowText label={label} />
      </span>
    );
  }

  return (
    <Link
      href={internalRoute(href)}
      aria-current={active ? "page" : undefined}
      className={cn(ROW_CLASS, nested ? "min-h-14" : "")}
      onClick={onNavigate}
    >
      {nested ? null : <RowIcon active={active} item={item} />}
      <RowText active={active} label={label} />
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground/60" />
      <NativeRouteProgress />
    </Link>
  );
}

// A group opens a bottom sheet listing its pages — the native way to offer "one of these",
// instead of a web accordion growing the list in place. The row's summary names what is inside,
// so the sheet rarely has to be opened just to look.
export function MoreGroupRow({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = menuItemLabel(item, t);
  const children = item.children ?? [];
  const summary = children.map((child) => menuItemLabel(child, t)).join(", ");
  const containsActive = children.some((child) => routeIsActive(pathname, child.path));

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <button
        type="button"
        aria-haspopup="dialog"
        className={cn(ROW_CLASS, "w-[calc(100%+1.5rem)]")}
        onClick={() => setOpen(true)}
      >
        <RowIcon active={containsActive} item={item} />
        <RowText active={containsActive} label={label} summary={summary} />
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground/60" />
      </button>
      {/* Edge-to-edge sheet with rounded top corners, above the gesture bar — the Android bottom
          sheet, not the floating inset panel the shared drawer draws by default. */}
      <DrawerContent className="p-0 pb-[max(env(safe-area-inset-bottom),0.75rem)] before:inset-0 before:rounded-none before:rounded-t-3xl before:border-0">
        <DrawerHeader className="flex-row items-center gap-3 px-5 pt-3 pb-2 text-left">
          <RowIcon item={item} />
          <DrawerTitle className="min-w-0 truncate text-lg font-semibold">{label}</DrawerTitle>
          <DrawerDescription className="sr-only">{summary}</DrawerDescription>
        </DrawerHeader>
        <nav aria-label={label} className="flex max-h-[60vh] flex-col overflow-y-auto overscroll-contain px-3 pb-2">
          {children.map((child) => (
            <MoreListRow
              key={child.path ?? child.title}
              item={child}
              nested
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
