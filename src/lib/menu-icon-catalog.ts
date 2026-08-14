import { iconNames } from "lucide-react/dynamic";
import {
  DEFAULT_MENU_ICON,
  MENU_ICON_COMPATIBILITY_VALUES,
  MENU_ICON_RESULT_LIMIT,
  menuIconLabel,
  normalizeMenuIconValue,
  type BuildMenuIconOptionsInput,
  type MenuIconLetterFilter,
  type MenuIconPickerOption,
  type MenuIconPickerResult
} from "@/lib/menu-icons";

const PRIORITY_MENU_ICON_ORDER = new Map(MENU_ICON_COMPATIBILITY_VALUES.map((name, index) => [name, index]));
const MENU_ICON_NAMES = [...iconNames].sort((a, b) => {
  const priorityA = PRIORITY_MENU_ICON_ORDER.get(a);
  const priorityB = PRIORITY_MENU_ICON_ORDER.get(b);

  if (typeof priorityA === "number" || typeof priorityB === "number") {
    return (priorityA ?? Number.MAX_SAFE_INTEGER) - (priorityB ?? Number.MAX_SAFE_INTEGER);
  }

  return a.localeCompare(b);
});
const MENU_ICON_NAME_SET = new Set<string>(MENU_ICON_NAMES);

export const MENU_ICON_TOTAL = MENU_ICON_NAMES.length;

export function normalizeMenuIconName(value: unknown) {
  const normalized = normalizeMenuIconValue(value);
  return MENU_ICON_NAME_SET.has(normalized) ? normalized : DEFAULT_MENU_ICON;
}

export const DEFAULT_MENU_ICON_OPTION: MenuIconPickerOption = {
  letter: "F",
  label: menuIconLabel(DEFAULT_MENU_ICON),
  searchText: DEFAULT_MENU_ICON,
  value: DEFAULT_MENU_ICON
};

const MENU_ICON_OPTIONS: MenuIconPickerOption[] = MENU_ICON_NAMES.map((name) => {
  const label = menuIconLabel(name);

  return {
    letter: name.charAt(0).toUpperCase() as MenuIconLetterFilter,
    label,
    searchText: [name, name.replaceAll("-", " "), label].join(" ").toLowerCase(),
    value: name
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
