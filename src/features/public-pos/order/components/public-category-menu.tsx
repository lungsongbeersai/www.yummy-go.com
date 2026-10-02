"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Grid2X2, List, ListFilter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PublicProductLayoutMode } from "../types";
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
  layoutMode,
  onLayoutModeChange,
  categories,
  activeCateUuid,
  jumpingCateUuid,
  onSelect,
}: {
  layoutMode: PublicProductLayoutMode;
  onLayoutModeChange: (mode: PublicProductLayoutMode) => void;
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
          className="h-8 shrink-0 gap-1 rounded-[8px] border border-transparent bg-transparent px-1.5 text-[11px] font-medium text-yg-accent-strong duration-150 ease-out hover:bg-yg-panel-hover hover:text-yg-accent-strong active:scale-95 active:duration-75 motion-reduce:transition-none"
        >
          <ListFilter className="size-3.5" aria-hidden="true" />
          <span className="lao-tone-text">{t("pos.categoriesButton")}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-80 max-w-[calc(100vw-2rem)] rounded-[8px] border-yg-divider bg-yg-card p-2 font-yg-sans text-yg-ink shadow-lg"
      >
        <div className="mb-2 grid grid-cols-2 gap-2 border-b border-yg-divider px-1 pt-1 pb-3" role="group" aria-label={`${t("pos.publicGridView")} / ${t("pos.publicListView")}`}>
          {(["grid", "list"] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              variant="ghost"
              aria-pressed={layoutMode === mode}
              onClick={() => onLayoutModeChange(mode)}
              className={cn(
                "h-10 justify-center gap-1.5 rounded-[8px] border px-3 text-xs font-medium",
                layoutMode === mode
                  ? "border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong hover:bg-yg-accent-soft"
                  : "border-yg-line bg-yg-panel text-yg-muted hover:bg-yg-panel-hover",
              )}
            >
              {mode === "grid" ? <Grid2X2 className="size-4" aria-hidden="true" /> : <List className="size-4" aria-hidden="true" />}
              <span className="lao-tone-text">{t(mode === "grid" ? "pos.publicGridView" : "pos.publicListView")}</span>
            </Button>
          ))}
        </div>
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
