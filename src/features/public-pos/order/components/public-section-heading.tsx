"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** หัวข้อ section ตามดีไซน์ — eyebrow ตัวเล็กพร้อมชื่อหมวดที่อ่านชัด
 *  eyebrow/icon เป็นของเสริม ไม่ใส่ก็เหลือแค่ชื่อ section ล้วน ๆ
 *  ช่อง meta ทางขวาใช้ได้ทั้งจำนวนรายการและปุ่ม */
export function PublicSectionHeading({
  eyebrow,
  title,
  icon,
  meta,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  icon?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex min-w-0 items-center justify-between gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <span className="block text-xs font-semibold uppercase tracking-wider text-yg-accent-strong">
              {eyebrow}
            </span>
          ) : null}
          <h2
            className={cn(
              "lao-tone-text line-clamp-2 break-words font-yg-sans text-lg font-bold leading-7 text-yg-ink sm:text-xl",
              eyebrow ? "mt-0.5" : "",
            )}
          >
            {title}
          </h2>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {meta ? (
          <span className="inline-flex min-h-6 items-center whitespace-nowrap rounded-full border border-yg-line bg-yg-panel px-2 font-yg-mono text-xs font-medium text-yg-muted">
            {meta}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  );
}
