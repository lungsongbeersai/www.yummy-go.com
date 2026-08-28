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
  nested = false,
  pathname,
}: {
  item: MenuItem;
  // ลูกของกลุ่ม (เรนเดอร์ใน AccordionContent ของ MoreGroupRow) ต้องเบากว่ารายการหลัก
  // ชัดเจน ไม่งั้นสูง/ระยะ/ขนาดตัวอักษรเท่ากันหมดจนแยกลำดับชั้นไม่ออกเลยว่าอันไหนเป็นกลุ่ม
  // อันไหนเป็นลูก (ตามที่รายงานมา) — min-h-11 (44px) ยังผ่านเกณฑ์ touch target ขั้นต่ำ
  nested?: boolean;
  pathname: string;
}) {
  const { t } = useTranslation();
  const label = menuItemLabel(item, t);
  const href = item.path;
  const showChevron = Boolean(item.children?.length);
  const active = routeIsActive(pathname, item.path);
  const iconClassName = nested ? "size-4 shrink-0" : "size-5 shrink-0";

  if (item.disabled || !href) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          "flex items-center px-4 opacity-50",
          nested ? "min-h-11 gap-3 text-sm" : "min-h-16 gap-4 text-base",
        )}
      >
        <DestinationIcon className={iconClassName} item={item} />
        {label}
      </span>
    );
  }

  return (
    <Link
      href={internalRoute(href)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        nested ? "min-h-11 gap-3 text-sm" : "min-h-16 gap-4 text-base",
        active ? "font-bold text-primary" : "hover:bg-accent",
      )}
    >
      <DestinationIcon className={iconClassName} item={item} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {showChevron ? (
        <ChevronRight className={cn(iconClassName, "text-muted-foreground")} />
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
      {/* [&_a]:no-underline ทับ [&_a]:underline ของ AccordionContent เอง — ค่าเริ่มต้นนั้น
          ออกแบบไว้สำหรับ prose/FAQ ที่มีลิงก์แทรกในเนื้อความ ไม่ใช่เมนู navigation แบบนี้
          (ยืนยันแล้วว่า Accordion ในแอปนี้ใช้ที่นี่จุดเดียว ไม่กระทบที่อื่น) */}
      <AccordionContent className="px-0 pb-0 [&_a]:no-underline">
        <div className="flex flex-col pl-4">
          {item.children?.map((child) => (
            <MoreListRow key={child.path ?? child.title} item={child} nested pathname={pathname} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
