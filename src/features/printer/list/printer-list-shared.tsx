"use client";

import { type ReactNode } from "react";
import { Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const BADGE_LIST_MAX = 4;

// เดิมโชว์ badge ทุกตัวไม่จำกัด — เครื่องพิมพ์ที่มีหลาย role/category ทำให้ cell เดียวมี badge เล็กๆ
// เรียงกัน 8-10 ใบ ล้นเป็น 2-3 บรรทัด ทำให้ตารางดูรกและแถวสูงไม่เท่ากัน ตัดโชว์แค่ N ใบแรก
// ที่เหลือพับเข้า popover "+N" กดดูได้ครบ ไม่เสียข้อมูล แค่ไม่บังคับแสดงพร้อมกันทั้งหมด
export function BadgeList({
  emptyLabel,
  items,
  max = BADGE_LIST_MAX,
}: {
  emptyLabel: string;
  items: Array<{ label: string; value: string }>;
  max?: number;
}) {
  if (!items.length) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }

  const visible = items.slice(0, max);
  const overflow = items.slice(max);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((item) => (
        <Badge
          key={item.value}
          variant="outline"
          className="max-w-32 truncate bg-muted/40 font-medium"
        >
          {item.label}
        </Badge>
      ))}
      {overflow.length ? (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <Badge
                variant="outline"
                className="cursor-pointer bg-muted/70 font-semibold text-muted-foreground hover:bg-muted"
              >
                +{overflow.length}
              </Badge>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <div className="flex flex-wrap gap-1">
              {overflow.map((item) => (
                <Badge
                  key={item.value}
                  variant="outline"
                  className="max-w-full truncate bg-muted/40 font-medium"
                >
                  {item.label}
                </Badge>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

export function PrinterStatusBadge({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  const Icon = active ? Power : PowerOff;

  // ปิดใช้ (inactive) เป็นแค่สถานะปุ่มสลับ ไม่ใช่ error — เดิมใช้ --destructive (แดง) ทำให้เครื่องพิมพ์ที่
  // ปิดไว้ตั้งใจดูเหมือนมีปัญหา สลับเป็นโทนกลาง (secondary) ให้ตรงความหมาย เก็บ --destructive ไว้ใช้กับ error จริงๆ
  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-1 font-black whitespace-nowrap",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-transparent bg-secondary text-secondary-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </Badge>
  );
}

export function PrinterDetailMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/15 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 text-sm font-semibold">{value}</div>
    </div>
  );
}
