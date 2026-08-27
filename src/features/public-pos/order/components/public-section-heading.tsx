"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** หัวข้อ section ตามดีไซน์ — eyebrow ตัวเล็กเว้นห่าง ทับด้วยชื่อ serif
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
        "mb-4 flex min-w-0 items-end justify-between gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.22em] text-yg-accent">
              {eyebrow}
            </span>
          ) : null}
          <h2
            className={cn(
              "lao-tone-text truncate font-yg-serif text-[clamp(20px,4.4vw,28px)] font-semibold leading-tight text-yg-ink",
              eyebrow ? "mt-0.5" : "",
            )}
          >
            {title}
          </h2>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {meta ? (
          <span className="whitespace-nowrap font-yg-mono text-2xs font-semibold text-yg-faint">
            {meta}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  );
}
