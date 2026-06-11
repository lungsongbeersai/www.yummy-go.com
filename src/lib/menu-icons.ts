import { icons as mdiIcons } from "@iconify-json/mdi";

export const DEFAULT_MENU_ICON = "mdi:file-document-outline";
export const MENU_ICON_RESULT_LIMIT = 200;
export const MENU_ICON_LETTER_FILTERS = [
  "all",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z"
] as const;

export type MenuIconLetterFilter = (typeof MENU_ICON_LETTER_FILTERS)[number];

export interface BuildMenuIconOptionsInput {
  letter?: MenuIconLetterFilter;
  limit?: number;
  search?: string;
}

export interface MenuIconPickerOption {
  letter: MenuIconLetterFilter;
  label: string;
  searchText: string;
  value: string;
}

export interface MenuIconPickerResult {
  filteredTotal: number;
  options: MenuIconPickerOption[];
  total: number;
}

const LEGACY_MENU_ICON_ALIASES: Record<string, string> = {
  "bar-chart-3": "mdi:chart-bar",
  "circle-dollar-sign": "mdi:currency-usd-circle",
  "clipboard-list": "mdi:clipboard-list-outline",
  "fa fa-file": DEFAULT_MENU_ICON,
  "file-text": DEFAULT_MENU_ICON,
  home: "mdi:home",
  "layout-grid": "mdi:view-grid",
  layers: "mdi:layers",
  "map-pin": "mdi:map-marker",
  package: "mdi:package-variant-closed",
  palette: "mdi:palette",
  printer: "mdi:printer",
  ruler: "mdi:ruler",
  settings: "mdi:cog",
  "shopping-cart": "mdi:cart-outline",
  store: "mdi:store",
  table: "mdi:table",
  tags: "mdi:tag-multiple",
  users: "mdi:account-group",
  utensils: "mdi:silverware-fork-knife"
};

function normalizeIconValue(value: string) {
  return value.includes(":") ? value : `mdi:${value}`;
}

function iconNameFromValue(value: string) {
  return value.startsWith("mdi:") ? value.slice(4) : value;
}

const PRIORITY_MENU_ICON_NAMES = Array.from(new Set(Object.values(LEGACY_MENU_ICON_ALIASES).map(iconNameFromValue)));
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
    const normalized = normalizeIconValue(iconValue);
    terms[normalized] = [...(terms[normalized] ?? []), legacyName];
    return terms;
  },
  {}
);

export const MENU_ICON_TOTAL = MENU_ICON_NAMES.length;

export function menuIconLabel(value: string) {
  const name = iconNameFromValue(normalizeMenuIconName(value));
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeMenuIconName(value: unknown) {
  const rawValue = String(value ?? "").trim().toLowerCase();
  if (!rawValue) return DEFAULT_MENU_ICON;

  const aliasedValue = LEGACY_MENU_ICON_ALIASES[rawValue] ?? rawValue;
  const normalized = normalizeIconValue(aliasedValue);
  if (!normalized.startsWith("mdi:")) return DEFAULT_MENU_ICON;

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
