import type {
  CartOrder,
  CateProductItem,
  CateWithProducts,
  FetchCartStatusRule
} from "@/services/pos";
import type { CustomerFetchCateProductsParams } from "@/services/public-pos";

export const PUBLIC_MENU_KIND = {
  PROMOTION: "promotion",
  SET: "set",
  NORMAL: "normal"
} as const;

export type PublicMenuKind = (typeof PUBLIC_MENU_KIND)[keyof typeof PUBLIC_MENU_KIND];

export const MENU_KIND_LOAD_ORDER = [
  PUBLIC_MENU_KIND.PROMOTION,
  PUBLIC_MENU_KIND.SET,
  PUBLIC_MENU_KIND.NORMAL
] as const;

const MENU_KIND_STATUS_SORT_FK: Record<PublicMenuKind, number> = {
  [PUBLIC_MENU_KIND.NORMAL]: 1,
  [PUBLIC_MENU_KIND.SET]: 2,
  [PUBLIC_MENU_KIND.PROMOTION]: 3
};

const SPECIAL_CATEGORY_UUID: Record<Exclude<PublicMenuKind, "normal">, string> = {
  [PUBLIC_MENU_KIND.PROMOTION]: "__special_promotion__",
  [PUBLIC_MENU_KIND.SET]: "__special_set__"
};

export function publicMenuKindToStatusSortFk(kind: PublicMenuKind) {
  return MENU_KIND_STATUS_SORT_FK[kind];
}

export type PublicPosCategoryTab = Pick<CateWithProducts, "cate_uuid" | "cate_name" | "cate_icon">;

export interface PublicStatusMenu {
  categories: CateWithProducts[];
  categoryTabs: PublicPosCategoryTab[];
  selectedCateUuid: string;
  defaultCateUuid: string;
  loadedCateUuids: string[];
  loadingCateUuids: string[];
  loading: boolean;
  error: string | null;
  requestKey: string;
}

export type PublicMenuByKind = Record<PublicMenuKind, PublicStatusMenu>;

export function emptyStatusMenu(): PublicStatusMenu {
  return {
    categories: [],
    categoryTabs: [],
    selectedCateUuid: "",
    defaultCateUuid: "",
    loadedCateUuids: [],
    loadingCateUuids: [],
    loading: false,
    error: null,
    requestKey: ""
  };
}

export function emptyMenuByKind(): PublicMenuByKind {
  return MENU_KIND_LOAD_ORDER.reduce((menus, kind) => {
    menus[kind] = emptyStatusMenu();
    return menus;
  }, {} as PublicMenuByKind);
}

export function emptyProductBrowseState() {
  return {
    menuByKind: emptyMenuByKind(),
    categoryTabs: [],
    selectedCateUuid: "",
    defaultCateUuid: "",
    loadingMenu: false,
    menuRequestKey: ""
  };
}

export function normalizeCartStatusRule(result: unknown): FetchCartStatusRule | null {
  const record = result && typeof result === "object" ? (result as Record<string, unknown>) : null;
  const statusRule = record?.status_rule;
  return statusRule && typeof statusRule === "object" ? (statusRule as FetchCartStatusRule) : null;
}

export function normalizeCartOrders(result: unknown): CartOrder[] {
  const record = result && typeof result === "object" ? (result as Record<string, unknown>) : null;
  const rawOrders = record && ("orders" in record || "data" in record) ? record.orders ?? record.data : result;

  if (Array.isArray(rawOrders)) {
    return rawOrders.filter((order): order is CartOrder => Boolean(order && typeof order === "object"));
  }

  if (rawOrders && typeof rawOrders === "object") {
    return [rawOrders as CartOrder];
  }

  return [];
}

export function toCategoryTabs(categories: CateWithProducts[]): PublicPosCategoryTab[] {
  return categories.map((category) => ({
    cate_uuid: category.cate_uuid,
    cate_name: category.cate_name,
    cate_icon: category.cate_icon
  }));
}

export function normalizeCategories(categories: CateWithProducts[]) {
  return categories.map((category) => ({
    ...category,
    products: category.products ?? []
  }));
}

export function menuSequenceKey(params: CustomerFetchCateProductsParams) {
  return [params.t, params.lang ?? "", (params.cate_uuid ?? "").trim(), (params.search ?? "").trim()].join(":");
}

export function statusMenuRequestKey(params: CustomerFetchCateProductsParams, kind: PublicMenuKind) {
  return [params.t, params.lang ?? "", kind, (params.cate_uuid ?? "").trim(), (params.search ?? "").trim()].join(":");
}

export function firstAvailableCateUuid(categories: CateWithProducts[], selectedCateUuid?: string, defaultCateUuid?: string) {
  if (selectedCateUuid && categories.some((category) => category.cate_uuid === selectedCateUuid)) {
    return selectedCateUuid;
  }

  if (defaultCateUuid && categories.some((category) => category.cate_uuid === defaultCateUuid)) {
    return defaultCateUuid;
  }

  return categories[0]?.cate_uuid ?? "";
}

export function productCateUuids(categories: CateWithProducts[]) {
  return categories
    .filter((category) => (category.products?.length ?? 0) > 0)
    .map((category) => category.cate_uuid)
    .filter(Boolean);
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function mergeCategoryProducts(
  currentCategories: CateWithProducts[],
  nextCategories: CateWithProducts[],
  cateUuid: string
) {
  const nextByUuid = new Map(nextCategories.map((category) => [category.cate_uuid, category]));

  return currentCategories.map((category) => {
    const nextCategory = nextByUuid.get(category.cate_uuid);
    if (!nextCategory) return category;

    return {
      ...category,
      ...nextCategory,
      products: category.cate_uuid === cateUuid ? nextCategory.products ?? [] : category.products ?? []
    };
  });
}

export function splitSpecialProducts(products: CateProductItem[] = []) {
  return products.reduce(
    (groups, product) => {
      const statusSortFk = Number(product.status_sort_fk);
      if (statusSortFk === publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.PROMOTION)) {
        groups.promotion.push(product);
      } else if (statusSortFk === publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.SET)) {
        groups.set.push(product);
      }

      return groups;
    },
    { promotion: [] as CateProductItem[], set: [] as CateProductItem[] }
  );
}

export function toSpecialCategories(kind: Exclude<PublicMenuKind, "normal">, products: CateProductItem[]): CateWithProducts[] {
  if (!products.length) return [];

  return [
    {
      cate_uuid: SPECIAL_CATEGORY_UUID[kind],
      cate_name: kind,
      products
    }
  ];
}
