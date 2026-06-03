"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon, addCollection } from "@iconify/react";
import { icons as mdiIcons } from "@iconify-json/mdi";
import { Check, CircleSlash2, GripVertical, Search, X } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/settings-shell";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { Category, FetchCategoriesParams, SaveCategoryInput } from "@/services/category";
import type { Group } from "@/services/group";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCategoryStore } from "@/stores/category-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

addCollection(mdiIcons);

interface GroupOption {
  label: string;
  value: string;
}

interface CategoryLabels {
  category: string;
  formHint: string;
  group: string;
  icon: string;
  list: string;
  no: string;
  page: string;
  selectGroup: string;
  showing: string;
  sortAsc: string;
  sortDesc: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

interface CategoryIconOption {
  labelKey: string;
  value: string;
  aliases?: string[];
}

type CategoryIconGroup = "all" | "drinks" | "riceNoodles" | "meatSeafood" | "breadFastfood" | "desserts" | "fruits" | "vegetables" | "other";
type CategoryIconDirectGroup = Exclude<CategoryIconGroup, "all" | "other">;

interface CategoryIconPickerOption extends CategoryIconOption {
  custom: boolean;
  group: CategoryIconGroup;
  label: string;
  searchText: string;
}

const DEFAULT_CATEGORY_ICON = "mdi:folder-outline";

const CATEGORY_ICON_GROUPS: Array<{ value: CategoryIconGroup; labelKey: string }> = [
  { value: "all", labelKey: "settings.categoryIconGroups.all" },
  { value: "drinks", labelKey: "settings.categoryIconGroups.drinks" },
  { value: "riceNoodles", labelKey: "settings.categoryIconGroups.riceNoodles" },
  { value: "meatSeafood", labelKey: "settings.categoryIconGroups.meatSeafood" },
  { value: "breadFastfood", labelKey: "settings.categoryIconGroups.breadFastfood" },
  { value: "desserts", labelKey: "settings.categoryIconGroups.desserts" },
  { value: "fruits", labelKey: "settings.categoryIconGroups.fruits" },
  { value: "vegetables", labelKey: "settings.categoryIconGroups.vegetables" },
  { value: "other", labelKey: "settings.categoryIconGroups.other" }
];

const CATEGORY_ICON_DIRECT_GROUPS: CategoryIconDirectGroup[] = [
  "drinks",
  "riceNoodles",
  "meatSeafood",
  "breadFastfood",
  "desserts",
  "fruits",
  "vegetables"
];

const CATEGORY_ICON_GROUP_VALUES: Record<CategoryIconDirectGroup, Set<string>> = {
  drinks: new Set([
    "mdi:coffee",
    "mdi:coffee-to-go",
    "mdi:tea",
    "mdi:cup",
    "mdi:cup-water",
    "mdi:bottle-soda",
    "mdi:bottle-soda-classic",
    "mdi:water",
    "mdi:glass-mug",
    "mdi:glass-mug-variant",
    "mdi:beer",
    "mdi:beer-outline",
    "mdi:glass-wine",
    "mdi:bottle-wine",
    "mdi:glass-cocktail"
  ]),
  riceNoodles: new Set(["mdi:rice", "mdi:noodles", "mdi:bowl", "mdi:bowl-mix", "mdi:pasta"]),
  meatSeafood: new Set([
    "mdi:food-drumstick",
    "mdi:food-drumstick-outline",
    "mdi:food-steak",
    "mdi:sausage",
    "mdi:food-turkey",
    "mdi:fish",
    "mdi:fishbowl",
    "mdi:egg",
    "mdi:egg-fried"
  ]),
  breadFastfood: new Set(["mdi:pizza", "mdi:hamburger", "mdi:food-hot-dog", "mdi:taco", "mdi:food-croissant", "mdi:bread-slice", "mdi:pretzel"]),
  desserts: new Set(["mdi:cake", "mdi:cake-variant", "mdi:cupcake", "mdi:cookie", "mdi:candy", "mdi:candycane", "mdi:popcorn", "mdi:ice-cream"]),
  fruits: new Set([
    "mdi:food-apple",
    "mdi:food-apple-outline",
    "mdi:apple",
    "mdi:fruit-grapes",
    "mdi:fruit-cherries",
    "mdi:fruit-citrus",
    "mdi:fruit-pear",
    "mdi:fruit-pineapple",
    "mdi:fruit-watermelon"
  ]),
  vegetables: new Set(["mdi:carrot", "mdi:mushroom", "mdi:corn", "mdi:sprout", "mdi:leaf", "mdi:grain", "mdi:seed", "mdi:peanut"])
};

const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { value: "mdi:food", labelKey: "categoryIcons.food", aliases: ["meal", "menu"] },
  { value: "mdi:food-outline", labelKey: "categoryIcons.food", aliases: ["menu outline"] },
  { value: "mdi:food-variant", labelKey: "categoryIcons.food", aliases: ["dish"] },
  { value: "mdi:food-fork-drink", labelKey: "categoryIcons.silverware", aliases: ["cutlery"] },
  { value: "mdi:silverware", labelKey: "categoryIcons.silverware", aliases: ["cutlery"] },
  { value: "mdi:silverware-variant", labelKey: "categoryIcons.silverwareVariant", aliases: ["restaurant"] },
  { value: "mdi:silverware-fork-knife", labelKey: "categoryIcons.silverwareVariant", aliases: ["fork knife"] },
  { value: "mdi:chef-hat", labelKey: "categoryIcons.chefHat", aliases: ["chef", "kitchen"] },
  { value: "mdi:pot", labelKey: "categoryIcons.pot", aliases: ["cook"] },
  { value: "mdi:pot-steam", labelKey: "categoryIcons.pot", aliases: ["hot pot"] },
  { value: "mdi:rice", labelKey: "categoryIcons.rice", aliases: ["grain"] },
  { value: "mdi:noodles", labelKey: "categoryIcons.noodles", aliases: ["ramen"] },
  { value: "mdi:bowl", labelKey: "categoryIcons.soup", aliases: ["soup", "salad"] },
  { value: "mdi:bowl-mix", labelKey: "categoryIcons.soup", aliases: ["soup", "broth"] },
  { value: "mdi:pasta", labelKey: "categoryIcons.noodles", aliases: ["spaghetti"] },
  { value: "mdi:pizza", labelKey: "categoryIcons.pizza" },
  { value: "mdi:hamburger", labelKey: "categoryIcons.burger", aliases: ["burger"] },
  { value: "mdi:food-hot-dog", labelKey: "categoryIcons.burger", aliases: ["hot dog", "sausage"] },
  { value: "mdi:taco", labelKey: "categoryIcons.sandwich", aliases: ["snack"] },
  { value: "mdi:food-drumstick", labelKey: "categoryIcons.drumstick", aliases: ["chicken"] },
  { value: "mdi:food-drumstick-outline", labelKey: "categoryIcons.drumstick", aliases: ["chicken outline"] },
  { value: "mdi:food-steak", labelKey: "categoryIcons.steak", aliases: ["beef", "ham", "pork"] },
  { value: "mdi:sausage", labelKey: "categoryIcons.ham", aliases: ["pork"] },
  { value: "mdi:food-turkey", labelKey: "categoryIcons.drumstick", aliases: ["turkey"] },
  { value: "mdi:fish", labelKey: "categoryIcons.fish" },
  { value: "mdi:fishbowl", labelKey: "categoryIcons.seafood", aliases: ["seafood"] },
  { value: "mdi:egg", labelKey: "categoryIcons.egg" },
  { value: "mdi:egg-fried", labelKey: "categoryIcons.egg" },
  { value: "mdi:food-apple", labelKey: "categoryIcons.apple" },
  { value: "mdi:food-apple-outline", labelKey: "categoryIcons.apple" },
  { value: "mdi:apple", labelKey: "categoryIcons.apple" },
  { value: "mdi:fruit-grapes", labelKey: "categoryIcons.grapes", aliases: ["fruit"] },
  { value: "mdi:fruit-cherries", labelKey: "categoryIcons.cherry" },
  { value: "mdi:fruit-citrus", labelKey: "categoryIcons.citrus", aliases: ["orange", "lemon"] },
  { value: "mdi:fruit-pear", labelKey: "categoryIcons.grapes", aliases: ["fruit", "pear"] },
  { value: "mdi:fruit-pineapple", labelKey: "categoryIcons.grapes", aliases: ["fruit", "pineapple"] },
  { value: "mdi:fruit-watermelon", labelKey: "categoryIcons.grapes", aliases: ["fruit", "watermelon"] },
  { value: "mdi:carrot", labelKey: "categoryIcons.carrot", aliases: ["vegetable"] },
  { value: "mdi:mushroom", labelKey: "categoryIcons.carrot", aliases: ["vegetable"] },
  { value: "mdi:corn", labelKey: "categoryIcons.carrot", aliases: ["vegetable"] },
  { value: "mdi:sprout", labelKey: "categoryIcons.leaf", aliases: ["fresh", "sprout"] },
  { value: "mdi:leaf", labelKey: "categoryIcons.leaf" },
  { value: "mdi:grain", labelKey: "categoryIcons.wheat", aliases: ["wheat"] },
  { value: "mdi:seed", labelKey: "categoryIcons.wheat", aliases: ["grain"] },
  { value: "mdi:peanut", labelKey: "categoryIcons.nut" },
  { value: "mdi:cake", labelKey: "categoryIcons.cake" },
  { value: "mdi:cake-variant", labelKey: "categoryIcons.cakeVariant" },
  { value: "mdi:cupcake", labelKey: "categoryIcons.cake" },
  { value: "mdi:food-croissant", labelKey: "categoryIcons.croissant", aliases: ["bakery"] },
  { value: "mdi:bread-slice", labelKey: "categoryIcons.croissant", aliases: ["bread", "bakery"] },
  { value: "mdi:pretzel", labelKey: "categoryIcons.croissant", aliases: ["bakery"] },
  { value: "mdi:cookie", labelKey: "categoryIcons.cookie" },
  { value: "mdi:candy", labelKey: "categoryIcons.candy" },
  { value: "mdi:candycane", labelKey: "categoryIcons.candyCane" },
  { value: "mdi:popcorn", labelKey: "categoryIcons.popcorn" },
  { value: "mdi:ice-cream", labelKey: "categoryIcons.iceCream" },
  { value: "mdi:coffee", labelKey: "categoryIcons.coffee" },
  { value: "mdi:coffee-to-go", labelKey: "categoryIcons.coffee", aliases: ["take away"] },
  { value: "mdi:tea", labelKey: "categoryIcons.tea" },
  { value: "mdi:cup", labelKey: "categoryIcons.cup" },
  { value: "mdi:cup-water", labelKey: "categoryIcons.water" },
  { value: "mdi:bottle-soda", labelKey: "categoryIcons.cup", aliases: ["soft drink", "soda"] },
  { value: "mdi:bottle-soda-classic", labelKey: "categoryIcons.cup", aliases: ["soft drink", "soda"] },
  { value: "mdi:water", labelKey: "categoryIcons.water" },
  { value: "mdi:glass-mug", labelKey: "categoryIcons.mug" },
  { value: "mdi:glass-mug-variant", labelKey: "categoryIcons.mug" },
  { value: "mdi:beer", labelKey: "categoryIcons.beer", aliases: ["alcohol"] },
  { value: "mdi:beer-outline", labelKey: "categoryIcons.beer", aliases: ["alcohol"] },
  { value: "mdi:glass-wine", labelKey: "categoryIcons.wine" },
  { value: "mdi:bottle-wine", labelKey: "categoryIcons.wine" },
  { value: "mdi:glass-cocktail", labelKey: "categoryIcons.cocktail" },
  { value: "mdi:chili-hot", labelKey: "categoryIcons.spicy", aliases: ["hot", "spicy"] },
  { value: "mdi:fire", labelKey: "categoryIcons.spicy", aliases: ["hot", "spicy"] },
  { value: "mdi:star", labelKey: "categoryIcons.recommended" },
  { value: "mdi:heart", labelKey: "categoryIcons.favorite" },
  { value: "mdi:circle-slice-8", labelKey: "categoryIcons.dot", aliases: ["dot"] },
  { value: "mdi:basket", labelKey: "categoryIcons.basket" },
  { value: "mdi:cart", labelKey: "categoryIcons.shopping" },
  { value: "mdi:shopping", labelKey: "categoryIcons.shopping" },
  { value: "mdi:store", labelKey: "categoryIcons.store" },
  { value: "mdi:package", labelKey: "categoryIcons.package" },
  { value: "mdi:package-variant", labelKey: "categoryIcons.package" },
  { value: "mdi:food-takeout-box", labelKey: "categoryIcons.package", aliases: ["takeout"] },
  { value: "mdi:microwave", labelKey: "categoryIcons.microwave" },
  { value: "mdi:fridge", labelKey: "categoryIcons.microwave", aliases: ["cold"] },
  { value: "mdi:grill", labelKey: "categoryIcons.pot", aliases: ["bbq"] }
];

const LEGACY_CATEGORY_ICON_ALIASES: Record<string, string> = {
  "mdi:soup": "mdi:bowl-mix",
  "mdi:sandwich": "mdi:food-variant",
  "mdi:salad": "mdi:bowl",
  "mdi:ham": "mdi:food-steak",
  "mdi:shrimp": "mdi:fishbowl",
  "mdi:banana": "mdi:fruit-pear",
  "mdi:cherry": "mdi:fruit-cherries",
  "mdi:citrus": "mdi:fruit-citrus",
  "mdi:wheat": "mdi:grain",
  "mdi:wheat-off": "mdi:grain",
  "mdi:bean": "mdi:seed",
  "mdi:croissant": "mdi:food-croissant",
  "mdi:donut": "mdi:cookie",
  "mdi:candy-cane": "mdi:candycane",
  "mdi:glass-water": "mdi:cup-water",
  "mdi:martini": "mdi:glass-cocktail",
  "mdi:milk": "mdi:cup-water",
  "mdi:vegan": "mdi:leaf",
  "mdi:sparkles": "mdi:star",
  "mdi:circle-dot": "mdi:circle-slice-8",
  "mdi:platter": "mdi:food",
  "mdi:hand-platter": "mdi:food"
};

function value(row: Category | Group | null, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

function categoryName(row: Category) {
  return value(row, "cate_name", value(row, "cate_name_la", value(row, "cate_name_eng", "-")));
}

function groupLabel(row: Category | Group) {
  return value(row, "group_name", value(row, "group_name_la", value(row, "group_name_eng", "-")));
}

function rowStoreUuid(rows: Category[]) {
  return value(rows[0] ?? null, "store_uuid_fk");
}

function normalizeCategoryIconValue(rawValue: string) {
  const value = rawValue.trim().toLowerCase();
  if (!value) return "";
  return value.includes(":") ? value : `mdi:${value}`;
}

function categoryIconGroup(rawValue: string): CategoryIconGroup {
  const value = normalizeCategoryIconValue(rawValue);
  for (const group of CATEGORY_ICON_DIRECT_GROUPS) {
    if (CATEGORY_ICON_GROUP_VALUES[group].has(value)) return group;
  }
  return "other";
}

function categoryIconName(rawValue: string) {
  const value = normalizeCategoryIconValue(rawValue);
  if (!value) return DEFAULT_CATEGORY_ICON;
  const aliasedValue = LEGACY_CATEGORY_ICON_ALIASES[value] ?? value;
  if (!aliasedValue.startsWith("mdi:")) return aliasedValue;

  return mdiIcons.icons[aliasedValue.slice(4)] ? aliasedValue : DEFAULT_CATEGORY_ICON;
}

function CategoryIcon({ value: iconValue }: { value: string }) {
  return <Icon aria-hidden icon={categoryIconName(iconValue)} />;
}

function CategoryIconPicker({
  defaultValue,
  id,
  name
}: {
  defaultValue: string;
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
            <p className="mt-1 truncate text-xs text-muted-foreground">{iconValue || selected?.value || DEFAULT_CATEGORY_ICON}</p>
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
              <Search aria-hidden className="size-4" />
            </span>
            <Input
              className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              placeholder={t("settings.searchCategoryIcons")}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <Button aria-label="Clear search" size="iconSm" type="button" variant="ghost" onClick={() => setSearch("")}>
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
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{option.value}</span>
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

export function CategorySettingsPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const storeRows = useCategoryStore((state) => state.rows);
  const total = useCategoryStore((state) => state.total);
  const storeTotalPages = useCategoryStore((state) => state.totalPages);
  const search = useCategoryStore((state) => state.search);
  const hasLoaded = useCategoryStore((state) => state.hasLoaded);
  const loading = useCategoryStore((state) => state.loading);
  const refreshing = useCategoryStore((state) => state.refreshing);
  const saving = useCategoryStore((state) => state.saving);
  const setSearch = useCategoryStore((state) => state.setSearch);
  const loadRows = useCategoryStore((state) => state.load);
  const saveRow = useCategoryStore((state) => state.save);
  const removeRow = useCategoryStore((state) => state.remove);
  const loadGroupOptions = useReferenceStore((state) => state.loadGroups);
  const sortCategoryRows = useReferenceStore((state) => state.sortCategoryRows);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("1");
  const [editing, setEditing] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [displayRows, setDisplayRows] = useState<Category[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);

  const title = t("settings.modules.category.title");
  const description = t("settings.modules.category.description");
  const labels: CategoryLabels = {
    category: t("nav.category"),
    formHint: t("settings.categoryFormHint"),
    group: t("nav.food_group"),
    icon: t("fields.icon"),
    list: t("settings.categoryList"),
    no: t("fields.no"),
    page: t("common.pageLabel"),
    selectGroup: t("settings.selectGroup"),
    showing: t("common.showing"),
    sortAsc: t("common.asc"),
    sortDesc: t("common.desc")
  };
  const requestParams = useMemo<FetchCategoriesParams>(
    () => ({ search, page, limit, orderBy, lang: language, store_uuid_fk: storeUuid }),
    [language, limit, orderBy, page, search, storeUuid]
  );
  const orderedRows = displayRows.length === storeRows.length ? displayRows : storeRows;
  const pageSize = limit === "All" ? orderedRows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = limit === "All" ? 1 : Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const allRowsLoaded = limit === "All" || totalPages === 1;
  const rows = allRowsLoaded ? orderedRows : storeRows;
  const groupOptionsStoreUuid = storeUuid || rowStoreUuid(storeRows);
  const dragEnabled = allRowsLoaded && rows.length > 1;
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const ids = useMemo(() => rows.map((row) => value(row, "cate_uuid")).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function load() {
    try {
      await loadRows(requestParams);
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  useEffect(() => {
    setDisplayRows(storeRows);
  }, [storeRows]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, page, limit, orderBy, storeUuid]);

  useEffect(() => {
    if (!groupOptionsStoreUuid) {
      setGroupOptions([]);
      return;
    }

    let active = true;
    loadGroupOptions(language, groupOptionsStoreUuid)
      .then((groups) => {
        if (!active) return;
        setGroupOptions(
          groups
            .map((group) => ({ label: groupLabel(group), value: value(group, "group_uuid") }))
            .filter((option) => option.value)
        );
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("settings.modules.group.title") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [groupOptionsStoreUuid, language, loadGroupOptions, showToast, t]);

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(ids);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [ids]);

  function applyFilters() {
    if (page === 1) void load();
    else setPage(1);
  }

  function toggleSelected(id: string, checked: boolean) {
    if (!id) return;
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedRows(checked ? new Set(ids) : new Set());
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Category) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function save(formData: FormData) {
    const input: SaveCategoryInput = {
      store_uuid_fk: storeUuid,
      group_uuid_fk: formData.get("group_uuid_fk") ?? "",
      cate_name_la: formData.get("cate_name_la") ?? "",
      cate_name_eng: formData.get("cate_name_eng") ?? "",
      cate_icon: formData.get("cate_icon") ?? ""
    };
    const id = value(editing, "cate_uuid");
    if (id) input.cate_uuid = id;

    try {
      await saveRow(input);
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: Category) {
    const id = value(row, "cate_uuid");
    if (!id) return;
    try {
      await removeRow(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function persistOrder(nextRows: Category[]) {
    const previousRows = rows;
    const sortStoreUuid = storeUuid || rowStoreUuid(nextRows);
    if (!sortStoreUuid) {
      showToast({
        title: t("category.sortFailed"),
        description: t("settings.storeRequired"),
        tone: "error"
      });
      return;
    }

    setDisplayRows(nextRows);
    try {
      await sortCategoryRows({
        store_uuid_fk: sortStoreUuid,
        items: nextRows
          .map((row, index) => ({ cate_uuid: value(row, "cate_uuid"), cate_sort: index + 1 }))
          .filter((item) => item.cate_uuid)
      });
      showToast({ title: t("category.sorted"), tone: "success" });
      await loadRows(requestParams, { background: true });
    } catch (error) {
      setDisplayRows(previousRows);
      showToast({
        title: t("category.sortFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!dragEnabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((row) => value(row, "cate_uuid") === String(active.id));
    const newIndex = rows.findIndex((row) => value(row, "cate_uuid") === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void persistOrder(arrayMove(rows, oldIndex, newIndex));
  }

  const tableBody = (
    <TableBody>
      {rows.map((row, index) => {
        const id = value(row, "cate_uuid");
        const selected = selectedRows.has(id);
        const iconValue = value(row, "cate_icon");
        const cells = (
          <>
            <TableCell className="w-10 px-2">
              <Checkbox aria-label={t("common.selectRow", { name: categoryName(row) })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
            </TableCell>
            <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{pageStart + index}</TableCell>
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <CategoryIcon value={iconValue} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-black">{categoryName(row)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {value(row, "cate_name_la", "-")} / {value(row, "cate_name_eng", "-")}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{groupLabel(row)}</TableCell>
            <TableCell>
              <Badge className="min-w-0 max-w-48 truncate">{iconValue || "-"}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
            </TableCell>
          </>
        );

        if (!dragEnabled) {
          return (
            <TableRow key={id || index} data-state={selected ? "selected" : undefined}>
              {cells}
            </TableRow>
          );
        }

        return (
          <SortableCategoryRow key={id || index} id={id} selected={selected}>
            {cells}
          </SortableCategoryRow>
        );
      })}
    </TableBody>
  );

  const table = (
    <Table className="min-w-[1040px]">
      <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
        <TableRow>
          {dragEnabled ? <TableHead className="w-10 px-2" aria-hidden /> : null}
          <TableHead className="w-10 px-2">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
          </TableHead>
          <TableHead className="w-px whitespace-nowrap px-2 text-center">{labels.no}</TableHead>
          <TableHead>{labels.category}</TableHead>
          <TableHead>{labels.group}</TableHead>
          <TableHead>{labels.icon}</TableHead>
          <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      {dragEnabled ? (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tableBody}
        </SortableContext>
      ) : (
        tableBody
      )}
    </Table>
  );
  const tableContent = rows.length ? (
    <SettingsTableScroll>
      {dragEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          {table}
        </DndContext>
      ) : (
        table
      )}
    </SettingsTableScroll>
  ) : null;
  const mobileList = rows.length ? (
    <SettingsMobileList>
      {rows.map((row, index) => {
        const id = value(row, "cate_uuid");
        const selected = selectedRows.has(id);
        const iconValue = value(row, "cate_icon");
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            badges={<Badge className="shrink-0">{pageStart + index}</Badge>}
            checked={selected}
            leading={
              <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                <CategoryIcon value={iconValue} />
              </span>
            }
            selectLabel={t("common.selectRow", { name: categoryName(row) })}
            selected={selected}
            subtitle={
              <span className="block truncate">
                {value(row, "cate_name_la", "-")} / {value(row, "cate_name_eng", "-")}
              </span>
            }
            title={categoryName(row)}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={labels.group} value={groupLabel(row)} />
              <SettingsMobileMeta label={labels.icon} value={<Badge className="min-w-0 max-w-full truncate">{iconValue || "-"}</Badge>} />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${labels.category}`}
        cardTitle={labels.list}
        description={description}
        emptyDescription={t("empty.adjustSearch")}
        emptyTitle={t("settings.noRecords", { title: title.toLowerCase() })}
        footer={
          rows.length ? (
            <SettingsPaginationFooter
              canGoBack={canGoBack}
              canGoNext={canGoNext}
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onBack={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          ) : undefined
        }
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        mobileList={mobileList}
        summary={`${t("common.showingRange", { start: pageStart, end: pageEnd, total })} - ${t("common.page", { current: page, total: totalPages })}`}
        table={tableContent}
        title={title}
        toolbar={
          <SettingsToolbar
            state={{
              search,
              limit,
              orderBy,
              limitOptions: PAGE_LIMIT_OPTIONS,
              orderOptions: [
                { label: labels.sortAsc, value: "1" },
                { label: labels.sortDesc, value: "-1" }
              ],
              selectedCount: selectedRows.size,
              onApply: applyFilters,
              onLimit: (nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              },
              onOrder: (nextOrder) => {
                setOrderBy(nextOrder);
                setPage(1);
              },
              onSearch: setSearch
            }}
          />
        }
        onAdd={openCreate}
      />
      <CategoryFormDialog
        description={description}
        editing={editing}
        groupOptions={groupOptions}
        labels={labels}
        open={dialogOpen}
        saving={saving}
        title={title}
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setDialogOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
        onSubmit={save}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        description={t("settings.deleteConfirm")}
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </>
  );
}

function SortableCategoryRow({ children, id, selected }: { children: ReactNode; id: string; selected: boolean }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    position: "relative" as const
  };
  return (
    <TableRow ref={setNodeRef} style={style} data-state={selected ? "selected" : undefined} className={cn(isDragging && "shadow-md")}>
      <TableCell className="w-10 px-2">
        <Button aria-label={t("common.reorder")} size="iconSm" type="button" variant="ghost" {...attributes} {...listeners}>
          <GripVertical />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  );
}

function CategoryFormDialog({
  description,
  editing,
  groupOptions,
  labels,
  onOpenChange,
  onSubmit,
  open,
  saving,
  title
}: {
  description: string;
  editing: Category | null;
  groupOptions: GroupOption[];
  labels: CategoryLabels;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const [groupUuid, setGroupUuid] = useState("");

  useEffect(() => {
    setGroupUuid(value(editing, "group_uuid_fk"));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-5xl">
        <SettingsDialogForm action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{labels.formHint}</FieldLabel>
                <FieldDescription>{labels.selectGroup}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="group_uuid_fk">{labels.group}</FieldLabel>
                <input name="group_uuid_fk" type="hidden" value={groupUuid} />
                <Select required value={groupUuid} onValueChange={setGroupUuid}>
                  <SelectTrigger id="group_uuid_fk" className="w-full">
                    <SelectValue placeholder={labels.selectGroup} />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {groupOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="cate_name_la">{t("fields.nameLa")}</FieldLabel>
                  <Input id="cate_name_la" name="cate_name_la" defaultValue={value(editing, "cate_name_la", value(editing, "cate_name"))} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cate_name_eng">{t("fields.nameEn")}</FieldLabel>
                  <Input id="cate_name_eng" name="cate_name_eng" defaultValue={value(editing, "cate_name_eng")} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="cate_icon">{labels.icon}</FieldLabel>
                  <CategoryIconPicker id="cate_icon" name="cate_icon" defaultValue={value(editing, "cate_icon")} />
                </Field>
              </div>
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !groupUuid} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
