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

export const LEGACY_MENU_ICON_ALIASES: Readonly<Record<string, string>> = {
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

const MDI_ICON_VALUE = /^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MENU_ICON_COMPATIBILITY_VALUES = Array.from(
  new Set([DEFAULT_MENU_ICON, ...Object.values(LEGACY_MENU_ICON_ALIASES)])
);

export function normalizeMenuIconValue(value: unknown) {
  const rawValue = String(value ?? "").trim().toLowerCase();
  if (!rawValue) return DEFAULT_MENU_ICON;

  const aliasedValue = LEGACY_MENU_ICON_ALIASES[rawValue] ?? rawValue;
  const normalized = aliasedValue.includes(":") ? aliasedValue : `mdi:${aliasedValue}`;
  return MDI_ICON_VALUE.test(normalized) ? normalized : DEFAULT_MENU_ICON;
}

// Runtime normalization keeps valid-looking saved MDI values; the lazy catalog performs strict validation for picker choices.
export const normalizeMenuIconName = normalizeMenuIconValue;

export function menuIconLabel(value: string) {
  return normalizeMenuIconValue(value)
    .slice(4)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
