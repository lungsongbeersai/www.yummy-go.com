import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { DestinationIcon } from "@/components/layout/capacitor/nav-destination-button";
import { NativeRouteProgress } from "@/components/layout/capacitor/route-progress";
import { menuItemLabel, routeIsActive } from "@/components/layout/shell-menu-helpers";
import type { MenuItem } from "@/config/menu";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";

// ตรงกับ sidebar ฝั่งเว็บ (web/app-shell.tsx renderItem): มีลูก = กางเป็นกลุ่มเสมอ ไม่สน
// ว่า item.path ของกลุ่มจะมีหน้าเพจจริงรองรับหรือไม่ (เช่น "ตั้งค่า" ก็กางแทนการพาไปหน้า
// hub /settings) — path ของตัวลูกแต่ละอันต่างหากที่ใช้ navigate จริง
export function needsMoreGroupDropdown(item: MenuItem): boolean {
  return Boolean(item.children?.length);
}
export function MoreListRow({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const { t } = useTranslation();
  const label = menuItemLabel(item, t);
  const href = item.path;
  const showChevron = Boolean(item.children?.length);
  const active = routeIsActive(pathname, item.path);

  if (item.disabled || !href) {
    return (
      <span
        aria-disabled="true"
        className="flex min-h-16 items-center gap-4 px-4 text-base opacity-50"
      >
        <DestinationIcon item={item} />
        {label}
      </span>
    );
  }

  return (
    <Link
      href={internalRoute(href)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-16 items-center gap-4 px-4 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        active ? "font-bold text-primary" : "hover:bg-accent",
      )}
    >
      <DestinationIcon item={item} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {showChevron ? (
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      ) : null}
      <NativeRouteProgress />
    </Link>
  );
}

// กลุ่มไม่มี path ของตัวเอง — กางลูกเป็น dropdown ในที่เดิมแทนการ navigate ไปหน้าใหม่
export function MoreGroupRow({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const { t } = useTranslation();
  const label = menuItemLabel(item, t);

  return (
    <AccordionItem value={item.title} className="border-b-0">
      <AccordionTrigger className="min-h-16 items-center gap-4 px-4 py-0 text-base font-normal hover:no-underline">
        <span className="flex min-w-0 flex-1 items-center gap-4">
          <DestinationIcon item={item} />
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-0 pb-0">
        <div className="flex flex-col pl-4">
          {item.children?.map((child) => (
            <MoreListRow key={child.path ?? child.title} item={child} pathname={pathname} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
