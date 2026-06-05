"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Icon, addCollection } from "@iconify/react";
import { icons as mdiIcons } from "@iconify-json/mdi";
import { Check, CircleSlash2, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  CATEGORY_ICON_GROUPS,
  CATEGORY_ICON_OPTIONS,
  DEFAULT_CATEGORY_ICON,
  categoryIconGroup,
  categoryIconName,
  normalizeCategoryIconValue,
  type CategoryIconGroup,
  type CategoryIconPickerOption
} from "@/features/settings/category/category-icons";
import { cn } from "@/lib/utils";

addCollection(mdiIcons);

export function CategoryIcon({ value: iconValue }: { value: string }) {
  return <Icon aria-hidden icon={categoryIconName(iconValue)} />;
}

export function CategoryIconPicker({
  defaultValue,
  disabled = false,
  id,
  name
}: {
  defaultValue: string;
  disabled?: boolean;
  id: string;
  name: string;
}) {
  const { t } = useTranslation();
  const [activeGroup, setActiveGroup] = useState<CategoryIconGroup>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const initialValue = normalizeCategoryIconValue(defaultValue) || CATEGORY_ICON_OPTIONS[0]?.value || DEFAULT_CATEGORY_ICON;
  const [iconValue, setIconValue] = useState(initialValue);
  const options = useMemo<CategoryIconPickerOption[]>(() => {
    const normalizedDefault = normalizeCategoryIconValue(defaultValue);
    const baseOptions = CATEGORY_ICON_OPTIONS.map((option) => {
      const label = t(option.labelKey);
      return {
        ...option,
        custom: false,
        group: categoryIconGroup(option.value),
        label,
        searchText: [option.value, label, ...(option.aliases ?? [])].join(" ").toLowerCase()
      };
    });

    if (!normalizedDefault || baseOptions.some((option) => option.value === normalizedDefault)) return baseOptions;

    return [
      {
        label: normalizedDefault,
        labelKey: "categoryIcons.custom",
        searchText: normalizedDefault,
        value: normalizedDefault,
        aliases: [],
        custom: true,
        group: "other"
      },
      ...baseOptions
    ];
  }, [defaultValue, t]);

  const selected = options.find((option) => option.value === iconValue) ?? options[0];
  const selectedIcon = categoryIconName(iconValue || (selected?.value ?? ""));
  const groupOptions = useMemo(
    () => (activeGroup === "all" ? options : options.filter((option) => option.group === activeGroup)),
    [activeGroup, options]
  );
  const filteredOptions = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return groupOptions;
    return groupOptions.filter((option) => option.searchText.includes(query));
  }, [deferredSearch, groupOptions]);

  useEffect(() => {
    setIconValue(normalizeCategoryIconValue(defaultValue) || CATEGORY_ICON_OPTIONS[0]?.value || DEFAULT_CATEGORY_ICON);
    setActiveGroup("all");
    setSearch("");
  }, [defaultValue]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <input id={id} name={name} type="hidden" value={iconValue} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon aria-hidden icon={selectedIcon} width={26} height={26} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{t("settings.selectedIcon")}</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {selected?.custom ? t("settings.customIcon") : selected?.label || t("settings.selectIcon")}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground" translate="no">
              {iconValue || selected?.value || DEFAULT_CATEGORY_ICON}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
              {t(CATEGORY_ICON_GROUPS.find((group) => group.value === activeGroup)?.labelKey ?? "settings.categoryIconGroups.all")}
            </span>
            <Badge className="h-6 min-w-14 justify-center rounded-md bg-primary/10 px-2.5 text-primary">
              {filteredOptions.length} / {groupOptions.length}
            </Badge>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Search aria-hidden />
            </span>
            <Input
              className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              autoComplete="off"
              disabled={disabled}
              name="category_icon_search"
              placeholder={t("settings.searchCategoryIcons")}
              spellCheck={false}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <Button aria-label={t("common.clear")} disabled={disabled} size="iconSm" type="button" variant="ghost" onClick={() => setSearch("")}>
                <X aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_ICON_GROUPS.map((group) => {
          const isActive = activeGroup === group.value;
          return (
            <Button
              key={group.value}
              className="shrink-0"
              disabled={disabled}
              size="sm"
              type="button"
              variant={isActive ? "default" : "outline"}
              onClick={() => setActiveGroup(group.value)}
            >
              {t(group.labelKey)}
            </Button>
          );
        })}
      </div>

      <div className="max-h-[20rem] overflow-y-auto rounded-lg border border-border bg-background p-2">
        {filteredOptions.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOptions.map((option) => {
              const isActive = option.value === iconValue;
              return (
                <Button
                  key={option.value}
                  aria-selected={isActive}
                  className={cn(
                    "h-auto min-h-14 justify-start gap-3 px-3 py-2 text-left shadow-sm",
                    isActive && "border-primary bg-primary/10 text-foreground ring-2 ring-primary/15"
                  )}
                  disabled={disabled}
                  role="option"
                  title={option.label}
                  type="button"
                  variant="outline"
                  onClick={() => setIconValue(option.value)}
                >
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary", isActive && "ring-1 ring-primary/25")}>
                    <Icon aria-hidden icon={categoryIconName(option.value)} width={23} height={23} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{option.custom ? t("settings.customIcon") : option.label}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground" translate="no">
                      {option.value}
                    </span>
                  </span>
                  {isActive ? <Check aria-hidden /> : null}
                </Button>
              );
            })}
          </div>
        ) : (
          <Empty className="min-h-40 border border-dashed bg-muted/30 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
                <CircleSlash2 aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noCategoryIconsFound")}</EmptyTitle>
              <EmptyDescription>{t("settings.tryDifferentIconSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
