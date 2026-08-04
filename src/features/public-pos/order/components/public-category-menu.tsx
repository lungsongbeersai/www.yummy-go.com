"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, LayoutGrid, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PublicPosCategoryTab } from "@/stores/public-pos-store/helpers";

const PublicCategoryIcon = dynamic(
  () =>
    import("@/features/public-pos/order/components/public-category-icon").then(
      (mod) => mod.PublicCategoryIcon,
    ),
  { ssr: false },
);

/** ปุ่ม "ໝວດທັງໝົດ" ข้างแถบ pill เลื่อนแนวนอน — สำหรับร้านที่มีหมวดเยอะ
 *  จนต้องเลื่อนหาหมวดที่ต้องการ กดแล้วเห็นหมวดทั้งหมดในลิสต์เดียว เลือกแล้วกระโดดตรง
 *  ปุ่มนี้อยู่นอกพื้นที่เลื่อนของแถบ pill จึงกดถึงได้เสมอไม่ว่าจะเลื่อนไปสุดตรงไหน */
export function PublicCategoryMenu({
  categories,
  activeCateUuid,
  jumpingCateUuid,
  onSelect,
}: {
  categories: PublicPosCategoryTab[];
  activeCateUuid: string;
  jumpingCateUuid: string;
  onSelect: (cateUuid: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = t("pos.allCategories");

  if (!categories.length) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          className="size-11 shrink-0 rounded-2xl border border-yg-line bg-yg-panel text-yg-muted backdrop-blur-md hover:border-yg-accent-line hover:bg-yg-panel-hover hover:text-yg-ink"
        >
          <LayoutGrid className="size-4.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-72 rounded-[20px] border-yg-line bg-yg-bg2 p-2 font-yg-sans text-yg-ink shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)] dark:shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]"
      >
        <p className="px-2 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-yg-accent">
          {label}
        </p>

        <div className="flex max-h-[min(60vh,420px)] flex-col gap-1 overflow-y-auto">
          {categories.map((category) => {
            const active = category.cateUuid === activeCateUuid;
            const jumping = category.cateUuid === jumpingCateUuid;

            return (
              <button
                key={category.cateUuid}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onSelect(category.cateUuid);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-11 min-w-0 items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-yg-accent focus-visible:ring-offset-2 focus-visible:ring-offset-yg-bg2 motion-reduce:transition-none",
                  active
                    ? "bg-yg-accent-soft text-yg-accent-strong"
                    : "text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink",
                )}
              >
                {jumping ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <PublicCategoryIcon icon={category.cateIcon} />
                )}
                <span className="lao-tone-text min-w-0 flex-1 truncate">
                  {category.cateName}
                </span>
                {active ? (
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
