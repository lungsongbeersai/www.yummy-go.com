"use client";

import { Ban, ChefHat, CircleCheck, Clock, ListChecks, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { OrderItemStatus } from "@/config/pos-constants";
import { queueTabFallbackKey, type OrderQueueTab } from "@/features/pos/order-queue/order-queue-view";

const STATUS_ICON: Record<number, LucideIcon> = {
  [OrderItemStatus.WAITING_CONFIRM]: Clock,
  [OrderItemStatus.SENT_TO_KITCHEN]: ChefHat,
  [OrderItemStatus.SERVED]: CircleCheck,
  [OrderItemStatus.CANCELLED]: Ban
};

/**
 * แท็บสถานะเป็นไทล์ตัวเลขใหญ่ — ตัวเลขของทุกคิวคือข้อมูลที่พนักงานมองหาก่อนอย่างอื่น
 * (มีกี่ใบรอส่งครัว/รอเสิร์ฟ) เดิมเป็น pill แถวเดียวที่ล้นจอมือถือจนต้องมีลูกศรเลื่อน
 * ตอนนี้เป็น grid 2 คอลัมน์บนมือถือ 4 คอลัมน์ตั้งแต่ sm ขึ้นไป ไม่มีแท็บไหนหลุดขอบจออีก
 */
export function OrderQueueStatusTabs({
  tabs,
  status
}: {
  tabs: OrderQueueTab[];
  status: number;
}) {
  const { t } = useTranslation();

  return (
    // group-data-horizontal/tabs:h-auto ต้องเขียนทับ h-8 ของ TabsList ด้วย selector เดียวกัน
    // (specificity สูงกว่า .h-auto ธรรมดา — แพทเทิร์นเดียวกับ payment-dialog-content.tsx)
    <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid-cols-4">
      {tabs.map((tab) => {
        const active = status === tab.status;
        const Icon = STATUS_ICON[tab.status] ?? ListChecks;
        // จุดเตือนเฉพาะคิวที่ต้องมีคนลงมือ (รอยืนยันส่งครัว) และยังไม่ได้เปิดดูอยู่
        const needsAttention =
          !active && tab.status === OrderItemStatus.WAITING_CONFIRM && tab.total > 0;

        return (
          <TabsTrigger
            key={tab.status}
            value={String(tab.status)}
            className={cn(
              "h-auto min-w-0 flex-none justify-start gap-3 rounded-xl border-border bg-card px-3 py-2.5 text-left whitespace-normal text-foreground shadow-xs",
              // hover เฉพาะไทล์ที่ไม่ได้เลือก — ถ้าใส่ตลอด hover:bg ชนะ data-active:bg ตอนเมาส์ยังค้าง
              // อยู่บนไทล์ที่เพิ่งกด พื้นเขียวทึบหายจนตัวหนังสือสีขาวอ่านไม่ออก
              !active && "hover:border-primary/30 hover:bg-primary/5",
              "data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-md data-active:shadow-primary/20",
              "dark:data-active:border-primary dark:data-active:bg-primary dark:data-active:text-primary-foreground",
              "dark:text-foreground"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                // sm–lg ไทล์ 4 คอลัมน์แคบ (แท็บเล็ตแนวตั้ง + sidebar) ชื่อแท็บภาษาลาวถูกตัดถ้ามีไอคอน
                "flex size-9 shrink-0 items-center justify-center rounded-lg sm:hidden lg:flex",
                active ? "bg-primary-foreground/15" : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "lao-tone-text truncate text-xs font-bold",
                  active ? "text-primary-foreground/85" : "text-muted-foreground"
                )}
              >
                {tab.title || t(queueTabFallbackKey(tab.status))}
              </span>
              <span className="text-xl font-black leading-none tabular-nums">{tab.total}</span>
            </span>
            {needsAttention ? (
              <span
                aria-hidden="true"
                className="absolute right-2.5 top-2.5 size-2 rounded-full bg-warning ring-4 ring-warning/20"
              />
            ) : null}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
