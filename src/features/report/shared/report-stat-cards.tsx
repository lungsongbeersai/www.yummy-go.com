"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// การ์ดตัวเลขสรุปของหน้ารายงาน: ไอคอนในกรอบสีบอก "ชนิด" ของตัวเลข (ไม่ใช่แค่ตกแต่ง)
// ส่วนลด=แดง, VAT=ส้ม, ยอดขาย=เขียว, จำนวน=ฟ้า และใบ highlight สีธีมเต็มใบสำหรับยอดที่คนมองหาก่อน
// ใช้ token ของธีมทั้งหมด — primary เปลี่ยนตามสีธีมที่ผู้ใช้เลือก, dark mode มีค่าของตัวเอง

export type ReportStatTone = "primary" | "info" | "success" | "warning" | "danger" | "highlight";

export type ReportStat = {
  icon: LucideIcon;
  key: string;
  label: string;
  /** แสดงตัวเลขเป็นสีแดง (ใช้กับยอดส่วนลดที่มากกว่า 0) */
  negative?: boolean;
  /** กินพื้นที่ 2 ช่อง — ใช้กับใบ highlight ให้ตารางการ์ดเต็มแถวพอดี */
  span?: boolean;
  tone: ReportStatTone;
  value: ReactNode;
};

const ICON_CLASS: Record<ReportStatTone, string> = {
  primary: "bg-primary/10 text-primary-text",
  info: "bg-info/10 text-info-text",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-text",
  danger: "bg-destructive/10 text-destructive",
  highlight: "bg-primary-foreground/15 text-primary-foreground",
};

export function ReportStatCards({
  className,
  id,
  stats,
}: {
  /** ปรับจำนวนคอลัมน์ให้การ์ดเต็มแถวพอดี เช่น 6 ใบ = 3 คอลัมน์ */
  className?: string;
  id?: string;
  stats: ReportStat[];
}) {
  return (
    <section id={id} className={cn("grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4", className)}>
      {stats.map((stat) => {
        const highlight = stat.tone === "highlight";
        const Icon = stat.icon;

        return (
          <Card
            key={stat.key}
            size="sm"
            className={cn(stat.span && "col-span-2", highlight && "bg-primary text-primary-foreground ring-primary")}
          >
            <CardHeader>
              <CardDescription className={highlight ? "text-primary-foreground/80" : undefined}>
                {stat.label}
              </CardDescription>
              <CardTitle
                className={cn(
                  "text-base whitespace-nowrap tabular-nums sm:text-lg",
                  stat.negative && "text-destructive",
                )}
              >
                {stat.value}
              </CardTitle>
              <CardAction>
                <span className={cn("flex size-9 items-center justify-center rounded-lg", ICON_CLASS[stat.tone])}>
                  <Icon aria-hidden="true" className="size-4.5" />
                </span>
              </CardAction>
            </CardHeader>
          </Card>
        );
      })}
    </section>
  );
}
