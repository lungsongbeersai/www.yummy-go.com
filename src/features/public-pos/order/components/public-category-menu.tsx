"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ListFilter, Loader2 } from "lucide-react";
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
          aria-label={label}
          title={label}
          className="h-11 shrink-0 gap-1.5 rounded-xl border border-yg-accent-line bg-yg-accent-soft px-2.5 text-xs font-semibold text-yg-accent-strong duration-150 ease-out hover:bg-yg-panel-hover hover:text-yg-accent-strong motion-safe:active:scale-95 motion-reduce:transition-none"
        >
          <ListFilter className="size-4" aria-hidden="true" />
          <span className="lao-tone-text">{t("pos.categoriesButton")}</span>
        </Button>
      </PopoverTrigger>

      {/* พื้นทึบ bg-yg-bg2 — yg-card ในโหมดมืดโปร่ง 5.5% (ออกแบบไว้วางบนพื้นหน้า) เมนูลอยจึงเห็นรูปสินค้าทะลุ
          เงาเข้มขึ้นในโหมดมืดให้แยกชั้นจากพื้นหลังที่สีใกล้กัน (ชุดเดียวกับ public-tweaks-popover) */}
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-yg-divider bg-yg-bg2 p-3 font-yg-sans text-yg-ink shadow-xl"
      >
        <p className="lao-tone-text mb-2 border-b border-yg-divider px-3 pt-2 pb-3 text-base font-semibold text-yg-ink">
          {label}
        </p>

        <div className="flex max-h-[min(60vh,420px)] flex-col gap-1 overflow-y-auto">
          {categories.map((category) => {
            const active = category.cateUuid === activeCateUuid;
            const jumping = category.cateUuid === jumpingCateUuid;

            return (
              <Button
                variant="ghost"
                key={category.cateUuid}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onSelect(category.cateUuid);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-14 w-full min-w-0 justify-start items-center gap-3 rounded-[8px] px-3 text-left text-sm font-medium transition-[color,background-color,transform] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-yg-accent focus-visible:ring-offset-2 focus-visible:ring-offset-yg-card active:scale-[0.97] active:duration-75 motion-reduce:transition-none",
                  active
                    ? "bg-yg-accent-soft text-yg-accent-strong hover:bg-yg-accent-soft hover:text-yg-accent-strong"
                    : "text-yg-ink hover:bg-yg-panel-hover hover:text-yg-ink",
                )}
              >
                <span className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-[8px] border",
                  active
                    ? "border-yg-accent bg-yg-accent text-yg-on-accent"
                    : "border-yg-line bg-yg-panel2 text-yg-accent-strong",
                )}>
                  {jumping ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <PublicCategoryIcon icon={category.cateIcon} className="size-5" />
                  )}
                </span>
                <span className="lao-tone-text min-w-0 flex-1 truncate">
                  {category.cateName}
                </span>
                {active ? (
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
