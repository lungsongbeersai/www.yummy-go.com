"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import {
  ArrowLeft,
  Check,
  Moon,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { ProductSortStatus, type CateWithProducts } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { SORT_TABS } from "./order-customer-utils";

const CategoryIconView = dynamic(
  () =>
    import("./order-customer-category-icon").then(
      (mod) => mod.CategoryIconView,
    ),
  { ssr: false },
);

export function EmployeeSortTabs({
  activeSort,
  className,
  onSortChange,
}: {
  activeSort: ProductSortStatus;
  className?: string;
  onSortChange: (status: ProductSortStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("grid min-w-0 grid-cols-3 gap-2", className)}>
      {SORT_TABS.map((tab) => {
        const active = tab.status === activeSort;
        return (
          <Button
            key={tab.status}
            type="button"
            variant="ghost"
            className={cn(
              "h-11 justify-center rounded-full border border-white/20 bg-white/15 px-3 text-xs font-bold text-white shadow-sm hover:border-white/45 hover:bg-white/25 hover:text-white sm:text-sm",
              active &&
                "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
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
  onSearchChange,
  onSearchSubmit,
  search,
  showSearchLabel = false,
}: {
  className?: string;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  search: string;
  showSearchLabel?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <form
      className={cn("flex min-w-0 gap-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSearchSubmit();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/70" />
        <Input
          className="h-11 rounded-full border-white/25 bg-white/15 pl-9 font-semibold text-white shadow-sm placeholder:text-white/65"
          value={search}
          placeholder={t("pos.searchMenu")}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <Button
        type="submit"
        aria-label={t("actions.search")}
        className="h-11 shrink-0 rounded-full bg-primary px-3 text-primary-foreground shadow-sm hover:bg-primary/90 sm:px-4"
        disabled={loading}
      >
        {loading ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Search data-icon="inline-start" />
        )}
        {showSearchLabel ? (
          <span className="hidden sm:inline">{t("actions.search")}</span>
        ) : null}
      </Button>
    </form>
  );
}

export function EmployeeMobileHeaderActions({
  loading,
  onRefresh,
}: {
  loading: boolean;
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
          className="size-11 shrink-0 rounded-full border border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
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

export function EmployeeMenuControlDock({
  activeSort,
  loading,
  onSearchChange,
  onSearchSubmit,
  onSortChange,
  search,
}: {
  activeSort: ProductSortStatus;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSortChange: (status: ProductSortStatus) => void;
  search: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
        <EmployeeSortTabs
          activeSort={activeSort}
          className="lg:flex-1"
          onSortChange={onSortChange}
        />
        <EmployeeSearchForm
          className="lg:w-[min(36vw,440px)]"
          loading={loading}
          search={search}
          showSearchLabel
          onSearchChange={onSearchChange}
          onSearchSubmit={onSearchSubmit}
        />
      </div>
    </div>
  );
}

export const EmployeeCategorySidebar = memo(function EmployeeCategorySidebar({
  categories,
  loading,
  onBack,
  selectedCateUuid,
  onSelectCategory,
}: {
  categories: CateWithProducts[];
  loading: boolean;
  onBack: () => void;
  selectedCateUuid: string;
  onSelectCategory: (cateUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <aside className="relative hidden min-h-0 overflow-hidden bg-transparent p-2 text-white md:flex">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black/10"
      />
      <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("actions.back")}
          className="mx-auto size-10 shrink-0 rounded-full border border-white/20 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
          onClick={onBack}
        >
          <ArrowLeft data-icon="inline-start" />
        </Button>

        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg bg-white/20" />
            ))
          : categories.map((category) => {
              const active = category.cate_uuid === selectedCateUuid;
              return (
                <Tooltip key={category.cate_uuid}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn(
                        "h-20 w-full flex-col gap-1 rounded-lg border border-white/20 bg-white/8 px-2 text-white/85 hover:border-white/45 hover:bg-white/15 hover:text-white focus-visible:ring-white/60",
                        active &&
                          "border-white bg-white text-primary shadow-lg hover:bg-white hover:text-primary",
                      )}
                      onClick={() => onSelectCategory(category.cate_uuid)}
                    >
                      <CategoryIconView
                        icon={category.cate_icon}
                        className="size-6"
                      />
                      <span className="line-clamp-2 text-center text-xs font-black leading-4">
                        {category.cate_name}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {category.cate_name || t("pos.menu")}
                  </TooltipContent>
                </Tooltip>
              );
            })}
      </div>
    </aside>
  );
});

export const EmployeeCategoryRail = memo(function EmployeeCategoryRail({
  categories,
  selectedCateUuid,
  onSelectCategory,
}: {
  categories: CateWithProducts[];
  selectedCateUuid: string;
  onSelectCategory: (cateUuid: string) => void;
}) {
  if (!categories.length) return null;

  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-1 md:hidden">
      <div className="w-max min-w-full overflow-hidden rounded-2xl border border-white/20 bg-white/15 p-2 shadow-xl shadow-black/20">
        <div className="flex gap-2">
          {categories.map((category) => {
            const active = category.cate_uuid === selectedCateUuid;
            return (
              <Button
                key={category.cate_uuid}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-11 max-w-47.5 rounded-2xl border border-white/15 bg-black/20 px-3 text-sm font-black text-white hover:border-white/45 hover:bg-white/10 hover:text-white",
                  active &&
                    "border-white bg-white text-primary hover:bg-white hover:text-primary",
                )}
                onClick={() => onSelectCategory(category.cate_uuid)}
              >
                <CategoryIconView
                  icon={category.cate_icon}
                  className="size-5 shrink-0"
                />
                <span className="truncate">{category.cate_name}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
