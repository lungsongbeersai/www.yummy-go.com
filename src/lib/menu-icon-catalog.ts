import mdiIconCollection from "@iconify-json/mdi/icons.json";
import type { IconifyJSON } from "@iconify/types";
import {
  DEFAULT_MENU_ICON,
  LEGACY_MENU_ICON_ALIASES,
  MENU_ICON_COMPATIBILITY_VALUES,
  MENU_ICON_RESULT_LIMIT,
  menuIconLabel,
  normalizeMenuIconValue,
  type BuildMenuIconOptionsInput,
  type MenuIconLetterFilter,
  type MenuIconPickerOption,
  type MenuIconPickerResult
} from "@/lib/menu-icons";

const mdiIcons = mdiIconCollection as IconifyJSON;

function iconNameFromValue(value: string) {
  return value.slice(4);
}

const PRIORITY_MENU_ICON_NAMES = MENU_ICON_COMPATIBILITY_VALUES.map(iconNameFromValue);
const PRIORITY_MENU_ICON_ORDER = new Map(PRIORITY_MENU_ICON_NAMES.map((name, index) => [name, index]));
const MENU_ICON_NAMES = Object.keys(mdiIcons.icons).sort((a, b) => {
  const priorityA = PRIORITY_MENU_ICON_ORDER.get(a);
  const priorityB = PRIORITY_MENU_ICON_ORDER.get(b);

  if (typeof priorityA === "number" || typeof priorityB === "number") {
    return (priorityA ?? Number.MAX_SAFE_INTEGER) - (priorityB ?? Number.MAX_SAFE_INTEGER);
  }

  return a.localeCompare(b);
});
const MENU_ICON_NAME_SET = new Set(MENU_ICON_NAMES);
const LEGACY_SEARCH_TERMS_BY_VALUE = Object.entries(LEGACY_MENU_ICON_ALIASES).reduce<Record<string, string[]>>(
  (terms, [legacyName, iconValue]) => {
    terms[iconValue] = [...(terms[iconValue] ?? []), legacyName];
    return terms;
  },
  {}
);

export const MENU_ICON_TOTAL = MENU_ICON_NAMES.length;

export function normalizeMenuIconName(value: unknown) {
  const normalized = normalizeMenuIconValue(value);
  return MENU_ICON_NAME_SET.has(iconNameFromValue(normalized)) ? normalized : DEFAULT_MENU_ICON;
}

export const DEFAULT_MENU_ICON_OPTION: MenuIconPickerOption = {
  letter: "F",
  label: menuIconLabel(DEFAULT_MENU_ICON),
  searchText: DEFAULT_MENU_ICON,
  value: DEFAULT_MENU_ICON
};

const MENU_ICON_OPTIONS: MenuIconPickerOption[] = MENU_ICON_NAMES.map((name) => {
  const value = `mdi:${name}`;
  const label = menuIconLabel(value);
  const legacyTerms = LEGACY_SEARCH_TERMS_BY_VALUE[value] ?? [];

  return {
    letter: name.charAt(0).toUpperCase() as MenuIconLetterFilter,
    label,
    searchText: [value, name, name.replaceAll("-", " "), label, ...legacyTerms].join(" ").toLowerCase(),
    value
  };
});

export function buildMenuIconOptions({
  letter = "all",
  limit = MENU_ICON_RESULT_LIMIT,
  search = ""
}: BuildMenuIconOptionsInput = {}): MenuIconPickerResult {
  const query = search.trim().toLowerCase();
  const matches = query
    ? MENU_ICON_OPTIONS.filter((option) => option.searchText.includes(query))
    : MENU_ICON_OPTIONS;
  const activeLetter = query ? "all" : letter;
  const filteredMatches = activeLetter === "all"
    ? matches
    : matches.filter((option) => option.letter === activeLetter);

  return {
    filteredTotal: filteredMatches.length,
    options: filteredMatches.slice(0, limit),
    total: MENU_ICON_TOTAL
  };
}
