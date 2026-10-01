"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useRef } from "react";
import {
  Check,
  Moon,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { HorizontalScrollArrows } from "@/components/common/horizontal-scroll-arrows";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LANGUAGES } from "@/lib/language";
import { cn } from "@/lib/utils";
import type { CateWithProducts } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { ProductSortStatus, SORT_TABS } from "./order-customer-utils";

const CategoryIconView = dynamic(
  () =>
    import("./order-customer-category-icon").then(
      (mod) => mod.CategoryIconView
    ),
  { ssr: false }
);

export function EmployeeSortTabs({
  activeSort,
  className,
  neutral = false,
  onPrimary = false,
  onSortChange,
}: {
  activeSort: ProductSortStatus;
  className?: string;
  neutral?: boolean;
  onPrimary?: boolean;
  onSortChange: (status: ProductSortStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("pos.menu")}
      className={cn(
        "grid min-w-0 grid-cols-3 gap-1 overflow-hidden rounded-xl",
        onPrimary
          ? "border border-primary-foreground/25 bg-primary-foreground/15"
          : neutral
          ? "border border-primary/15 bg-primary/5"
          : "border border-white/20 bg-white/15 dark:border-border dark:bg-muted",
        className
      )}
    >
      {SORT_TABS.map((tab) => {
        const active = tab.status === activeSort;
        return (
          <Button
            key={tab.status}
            type="button"
            aria-pressed={active}
            variant="ghost"
            className={cn(
              "h-11 justify-center rounded-lg border-transparent px-2.5 text-xs font-bold shadow-none focus-visible:border-primary focus-visible:ring-primary lg:text-sm",
              onPrimary
                ? "bg-transparent text-primary-foreground/85 hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:border-primary-foreground focus-visible:ring-primary-foreground"
                : neutral
                ? "bg-transparent text-foreground/75 hover:bg-primary/10 hover:text-foreground"
                : "bg-transparent text-white/80 hover:bg-white/15 hover:text-white dark:text-muted-foreground dark:hover:bg-card dark:hover:text-foreground",
              active &&
                (onPrimary
                  ? "border-primary-foreground/70 bg-primary-foreground text-primary shadow-sm hover:bg-primary-foreground/90 hover:text-primary"
                  : neutral
                  ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground dark:border-primary dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                  : "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-primary-foreground dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90")
            )}
            onClick={() => onSortChange(tab.status)}
          >
            <span className="min-w-0 truncate">{t(tab.labelKey)}</span>
          </Button>
        );
      })}
    </div>
  );
}

export function EmployeeSearchForm({
  className,
  loading,
  neutral = false,
  onPrimary = false,
  onSearchChange,
  onSearchSubmit,
  search,
  showSearchLabel = false,
}: {
  className?: string;
  loading: boolean;
  neutral?: boolean;
  onPrimary?: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  search: string;
  showSearchLabel?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <form
      role="search"
      className={cn("flex min-w-0 gap-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSearchSubmit();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
            onPrimary
              ? "text-primary-text"
              : neutral
              ? "text-muted-foreground"
              : "text-white/70 dark:text-muted-foreground"
          )}
        />
        <Input
          aria-label={t("pos.searchMenu")}
          autoComplete="off"
          className={cn(
            "h-11 rounded-xl pl-9 font-semibold shadow-xs",
            onPrimary
              ? "border-primary-foreground/50 bg-primary-foreground text-foreground placeholder:text-muted-foreground"
              : neutral
              ? "border-border bg-card text-foreground placeholder:text-muted-foreground"
              : "border-white/25 bg-white/15 text-white placeholder:text-white/65 dark:border-border dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
          )}
          name="menu-search"
          placeholder={t("pos.searchMenu")}
          spellCheck={false}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <Button
        type="submit"
        aria-label={t("actions.search")}
        className={cn(
          "h-11 shrink-0 rounded-xl px-3 shadow-xs sm:px-4",
          onPrimary
            ? "border border-primary-foreground/40 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 hover:text-primary-foreground"
            : neutral
            ? "border border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        disabled={loading}
      >
        {loading ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Search data-icon="inline-start" />
        )}
        {showSearchLabel ? (
          <span className="hidden lg:inline">{t("actions.search")}</span>
        ) : null}
      </Button>
    </form>
  );
}

export function EmployeeMobileHeaderActions({
  loading,
  neutral = false,
  onPrimary = false,
  onRefresh,
}: {
  loading: boolean;
  neutral?: boolean;
  onPrimary?: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeLabel =
    theme === "dark" ? t("dashboard.lightTheme") : t("dashboard.darkTheme");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("common.actions")}
          className={cn(
            "size-11 shrink-0 rounded-full border shadow-sm",
            onPrimary
              ? "border-primary-foreground/35 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
              : neutral
              ? "border-primary/20 bg-card text-primary-text hover:bg-primary/10 hover:text-primary-text"
              : "border-white/25 bg-white/15 text-white hover:bg-white/25 hover:text-white dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent dark:hover:text-foreground"
          )}
        >
          <MoreHorizontal data-icon="inline-start" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          {LANGUAGES.map((item) => {
            const active = item.code === language;
            const label = item.code === "la" ? "LA" : "EN";
            return (
              <DropdownMenuItem
                key={item.code}
                className="font-semibold"
                onSelect={() => setLanguage(item.code)}
              >
                <span className="flex size-6 items-center justify-center rounded-sm bg-muted text-xs font-black text-muted-foreground">
                  {label}
                </span>
                {label}
                {active ? <Check className="ml-auto size-4" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => toggleTheme()}>
            <ThemeIcon data-icon="inline-start" />
            {themeLabel}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={loading} onSelect={onRefresh}>
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCcw data-icon="inline-start" />
            )}
            {t("actions.refresh")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const EmployeeCategorySidebar = memo(function EmployeeCategorySidebar({
  categories,
  loading,
  neutral = false,
  selectedCateUuid,
  onSelectCategory,
}: {
  categories: CateWithProducts[];
  loading: boolean;
  neutral?: boolean;
  selectedCateUuid: string;
  onSelectCategory: (cateUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t("pos.menu")}
      className={cn(
        "relative hidden min-h-0 overflow-hidden bg-transparent p-1.5 md:flex",
        neutral ? "text-foreground" : "text-white dark:text-foreground"
      )}
    >
      {!neutral ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-black/10 dark:hidden"
        />
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className={cn(
                    "h-[5.625rem] rounded-lg",
                    neutral ? "bg-muted" : "bg-white/20"
                  )}
                />
              ))
            : categories.map((category) => {
                const active = category.cateUuid === selectedCateUuid;
                const categoryLabel =
                  category.cateName?.trim() || t("pos.menu");
                return (
                  <Tooltip key={category.cateUuid}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        aria-pressed={active}
                        variant="ghost"
                        className={cn(
                          "h-auto min-h-[5.625rem] w-full shrink-0 flex-col gap-1 rounded-lg border px-2 py-2 shadow-sm",
                          neutral
                            ? "border-border bg-muted text-foreground/90 hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:ring-ring/60"
                            : "border-white/20 bg-white/10 text-white/90 shadow-black/5 hover:border-white/45 hover:bg-white/20 hover:text-white focus-visible:ring-white/60 dark:border-border dark:bg-card dark:text-foreground/90 dark:shadow-black/20 dark:hover:border-primary/40 dark:hover:bg-accent dark:hover:text-foreground dark:focus-visible:ring-ring/60",
                          // dark: มี selector &:is(.dark *) ซึ่ง specificity สูงกว่า utility เฉย ๆ (ดู
                          // @custom-variant dark ใน globals.css) — ต้องใส่ dark: ให้ active ด้วย ไม่งั้น
                          // dark:bg-card/dark:hover:bg-accent ด้านบนจะชนะ bg-primary เสมอในโหมดมืด ทำให้
                          // ปุ่มที่เลือกอยู่ไม่เปลี่ยนสีเลย
                          active &&
                            (neutral
                              ? "border-primary/40 bg-sidebar-accent text-sidebar-accent-foreground shadow-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:bg-sidebar-accent dark:text-sidebar-accent-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-accent-foreground"
                              : "border-primary/20 bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 hover:text-primary-foreground dark:border-primary/20 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 dark:hover:text-primary-foreground")
                        )}
                        onClick={() => onSelectCategory(category.cateUuid)}
                      >
                        <CategoryIconView
                          icon={category.cateIcon}
                          className="size-6 shrink-0"
                        />
                        <span className="block w-full shrink-0 whitespace-normal break-words text-center text-xs font-semibold leading-4">
                          {categoryLabel}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {categoryLabel}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
        </div>
      </div>
    </aside>
  );
});

export const EmployeeCategoryRail = memo(function EmployeeCategoryRail({
  categories,
  neutral = false,
  selectedCateUuid,
  wide = false,
  onSelectCategory,
}: {
  categories: CateWithProducts[];
  neutral?: boolean;
  selectedCateUuid: string;
  wide?: boolean;
  onSelectCategory: (cateUuid: string) => void;
}) {
  const { t } = useTranslation();
  const activeCategoryRef = useRef<HTMLButtonElement>(null);
  const categoryRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wide) return;
    activeCategoryRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedCateUuid, wide]);

  if (!categories.length) return null;

  return (
    <nav
      aria-label={t("nav.category")}
      className={cn(
        "-mx-3",
        wide
          ? "relative min-w-0"
          : "overflow-x-auto overflow-y-hidden px-3 pb-1 md:hidden"
      )}
    >
      <div
        ref={wide ? categoryRailRef : undefined}
        data-pos-category-rail={wide ? "true" : undefined}
        className={cn(
          wide
            ? "overflow-x-auto overflow-y-hidden px-3 pb-1 scroll-smooth scroll-px-3 touch-pan-x overscroll-x-contain [overflow-anchor:none] [scrollbar-width:thin]"
            : "contents"
        )}
      >
        <div
          data-pos-category-frame={wide ? "plain" : "card"}
          className={cn(
            wide
              ? "w-max min-w-full py-1"
              : "w-max min-w-full overflow-hidden rounded-2xl border p-1.5 shadow-sm",
            !wide &&
              (neutral
                ? "border-border bg-card"
                : "border-white/20 bg-white/15 shadow-xl shadow-black/20 dark:border-border dark:bg-card dark:shadow-black/40")
          )}
        >
          <div className="flex gap-2">
            {categories.map((category) => {
              const active = category.cateUuid === selectedCateUuid;
              const categoryLabel = category.cateName?.trim() || t("pos.menu");
              return (
                <Button
                  key={category.cateUuid}
                  ref={active ? activeCategoryRef : undefined}
                  type="button"
                  aria-pressed={active}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto min-h-11 shrink-0 rounded-2xl border px-3 py-1.5 text-sm font-black",
                    wide
                      ? "h-11 w-max max-w-none whitespace-nowrap px-4"
                      : "max-w-47.5",
                    neutral
                      ? wide
                        ? "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                        : "border-border bg-muted text-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground"
                      : "border-white/15 bg-black/20 text-white hover:border-white/45 hover:bg-white/10 hover:text-white dark:border-border dark:bg-card dark:text-foreground dark:hover:border-primary/40 dark:hover:bg-accent dark:hover:text-foreground",
                    // เหตุผลเดียวกับ EmployeeCategorySidebar ด้านบน — dark: ต้องมี selector เฉพาะให้ active ด้วย
                    active &&
                      (neutral
                        ? wide
                          ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground dark:border-primary dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                          : "border-primary/40 bg-sidebar-accent text-sidebar-accent-foreground shadow-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:bg-sidebar-accent dark:text-sidebar-accent-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-accent-foreground"
                        : "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:border-primary/20 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 dark:hover:text-primary-foreground")
                  )}
                  onClick={() => onSelectCategory(category.cateUuid)}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-center leading-5",
                      wide
                        ? "shrink-0 whitespace-nowrap"
                        : "whitespace-normal break-words"
                    )}
                  >
                    {categoryLabel}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
      {wide ? (
        <HorizontalScrollArrows
          className="size-11 border-primary bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:text-primary-foreground disabled:pointer-events-none"
          scrollRef={categoryRailRef}
        />
      ) : null}
    </nav>
  );
});
