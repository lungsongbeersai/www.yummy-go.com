"use client";

import {
  ArrowLeftRight,
  BadgePercent,
  CircleX,
  Hash,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OrderAuditAction } from "@/services/report";

// สี + ไอคอนต่อชนิดการเปลี่ยนแปลง: สร้าง=เขียว, แก้ไข/ส่วนลด/ราคา/จำนวน/ย้าย=ส้ม (ควรตรวจ),
// ลบ/ยกเลิก=แดง, ชำระเงิน=ฟ้า — ไอคอนช่วยแยกโดยไม่พึ่งสีอย่างเดียว (Design.md §10)
// text-*-text คือเฉดตัวอักษรที่ผ่าน contrast บนพื้นสว่าง (--warning/--info ออกแบบเป็นสี fill)
const ACTION_PRESENTATION: Record<OrderAuditAction, { className: string; icon: LucideIcon }> = {
  CREATE: { className: "bg-success/10 text-success", icon: Plus },
  UPDATE: { className: "bg-warning/15 text-warning-text", icon: Pencil },
  DELETE: { className: "bg-destructive/10 text-destructive", icon: Trash2 },
  DISCOUNT: { className: "bg-warning/15 text-warning-text", icon: BadgePercent },
  PRICE: { className: "bg-warning/15 text-warning-text", icon: Tag },
  QUANTITY: { className: "bg-warning/15 text-warning-text", icon: Hash },
  CANCEL: { className: "bg-destructive/10 text-destructive", icon: CircleX },
  MOVE: { className: "bg-warning/15 text-warning-text", icon: ArrowLeftRight },
  PAYMENT: { className: "bg-info/10 text-info-text", icon: Wallet },
};

export function OrderAuditActionBadge({ action, label }: { action: OrderAuditAction; label: string }) {
  const presentation = ACTION_PRESENTATION[action];
  if (!presentation) return <Badge variant="secondary">{label}</Badge>;
  const Icon = presentation.icon;

  return (
    <Badge className={presentation.className}>
      <Icon data-icon="inline-start" />
      {label}
    </Badge>
  );
}
