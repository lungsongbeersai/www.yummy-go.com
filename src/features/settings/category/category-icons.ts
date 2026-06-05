import { icons as mdiIcons } from "@iconify-json/mdi";

export interface CategoryIconOption {
  labelKey: string;
  value: string;
  aliases?: string[];
}

export type CategoryIconGroup =
  | "all"
  | "drinks"
  | "riceNoodles"
  | "meatSeafood"
  | "breadFastfood"
  | "desserts"
  | "fruits"
  | "vegetables"
  | "other";

type CategoryIconDirectGroup = Exclude<CategoryIconGroup, "all" | "other">;

export interface CategoryIconPickerOption extends CategoryIconOption {
  custom: boolean;
  group: CategoryIconGroup;
  label: string;
  searchText: string;
}

export const DEFAULT_CATEGORY_ICON = "mdi:folder-outline";

export const CATEGORY_ICON_GROUPS: Array<{ value: CategoryIconGroup; labelKey: string }> = [
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

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
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

export function normalizeCategoryIconValue(rawValue: string) {
  const value = rawValue.trim().toLowerCase();
  if (!value) return "";
  return value.includes(":") ? value : `mdi:${value}`;
}

export function categoryIconGroup(rawValue: string): CategoryIconGroup {
  const value = normalizeCategoryIconValue(rawValue);
  for (const group of CATEGORY_ICON_DIRECT_GROUPS) {
    if (CATEGORY_ICON_GROUP_VALUES[group].has(value)) return group;
  }
  return "other";
}

export function categoryIconName(rawValue: string) {
  const value = normalizeCategoryIconValue(rawValue);
  if (!value) return DEFAULT_CATEGORY_ICON;
  const aliasedValue = LEGACY_CATEGORY_ICON_ALIASES[value] ?? value;
  if (!aliasedValue.startsWith("mdi:")) return aliasedValue;
  return mdiIcons.icons[aliasedValue.slice(4)] ? aliasedValue : DEFAULT_CATEGORY_ICON;
}
