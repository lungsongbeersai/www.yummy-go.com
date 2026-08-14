export const DEFAULT_MENU_ICON = "file-text";
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

// menu_icon values saved before the Lucide migration used the Iconify "mdi:" prefix. Map the
// handful of icons the picker actually offered back to their Lucide equivalent so menu items
// saved under the old system keep their icon without an admin having to re-pick it.
export const LEGACY_MDI_ICON_ALIASES: Readonly<Record<string, string>> = {
  "mdi:account-group": "users",
  "mdi:cart-outline": "shopping-cart",
  "mdi:chart-bar": "bar-chart-3",
  "mdi:clipboard-list-outline": "clipboard-list",
  "mdi:cog": "settings",
  "mdi:currency-usd-circle": "circle-dollar-sign",
  "mdi:file-document-outline": DEFAULT_MENU_ICON,
  "mdi:home": "home",
  "mdi:layers": "layers",
  "mdi:map-marker": "map-pin",
  "mdi:package-variant-closed": "package",
  "mdi:palette": "palette",
  "mdi:printer": "printer",
  "mdi:ruler": "ruler",
  "mdi:silverware-fork-knife": "utensils",
  "mdi:store": "store",
  "mdi:table": "table",
  "mdi:tag-multiple": "tags",
  "mdi:view-grid": "layout-grid"
};

export const MENU_ICON_COMPATIBILITY_VALUES = Array.from(
  new Set([DEFAULT_MENU_ICON, ...Object.values(LEGACY_MDI_ICON_ALIASES)])
);

const LUCIDE_ICON_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function normalizeMenuIconValue(value: unknown) {
  const rawValue = String(value ?? "").trim().toLowerCase();
  if (!rawValue) return DEFAULT_MENU_ICON;

  const aliasedValue = LEGACY_MDI_ICON_ALIASES[rawValue] ?? rawValue;
  return LUCIDE_ICON_NAME.test(aliasedValue) ? aliasedValue : DEFAULT_MENU_ICON;
}

// Runtime normalization keeps valid-looking saved names; the lazy catalog performs strict
// validation against the real Lucide icon set for picker choices.
export const normalizeMenuIconName = normalizeMenuIconValue;

export function menuIconLabel(value: string) {
  return normalizeMenuIconValue(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
