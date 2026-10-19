import type { Product, ProductDetail } from "@/services/product";
import { normalizeMenuCatalogRows, type MenuCatalogRows } from "./product-menu-templates";

export interface ProductMenuLabels {
  uncategorized: string;
  regular: string;
  contactPrice: string;
  included?: string;
  chooseCount?: (count: number) => string;
}

export interface MenuPriceEntry {
  id: string;
  label: string;
  amount: number | null;
  priceText: string;
}

export interface MenuProduct {
  id: string;
  number: number;
  name: string;
  secondaryName: string;
  categoryId: string;
  categoryName: string;
  imageFilename: string;
  type: "normal" | "set";
  prices: MenuPriceEntry[];
  options: string[];
  /** Oversized records continue on another page without dropping size rows. */
  continued?: boolean;
  originalId?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuProduct[];
}

export interface MenuCategorySegment extends MenuCategory {
  continued: boolean;
  column?: number;
}

export interface ProductMenuPage {
  sections: MenuCategorySegment[];
}

export interface ProductMenuPaginationOptions {
  columnHeight?: number;
  categoryHeaderHeight?: number;
  categoryGap?: number;
  itemGap?: number;
  productHeights?: Readonly<Record<string, number>>;
  categoryHeights?: Readonly<Record<string, number>>;
}

export interface ProductCatalogPaginationOptions {
  columns?: 2 | 3 | 4 | 6;
  rows?: MenuCatalogRows;
  /** The allocated height of one card in the selected page grid. */
  cardHeight?: number;
  /** Fixed photo/padding height repeated on every continuation card. */
  productFixedHeight?: number;
  productHeights?: Readonly<Record<string, number>>;
}

export interface ProductMenuColumnsPaginationOptions {
  columns?: 1 | 2 | 3;
  columnHeight?: number;
  /** Columns can begin at different heights below a header or hero photo. */
  columnHeights?: readonly number[];
  categoryHeaderHeight?: number;
  categoryHeights?: Readonly<Record<string, number>>;
  productHeights?: Readonly<Record<string, number>>;
  itemGap?: number;
  categoryGap?: number;
  maxPhotosPerPage?: number;
  images?: Readonly<Record<string, string>>;
}

function text(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    if (cleaned) return cleaned;
  }
  return "";
}

function localized(
  row: Record<string, unknown>,
  prefix: "prod" | "cate" | "size" | "group",
  language: string,
): string {
  const preferred = language.toLowerCase().startsWith("en") ? "eng" : "la";
  const other = preferred === "eng" ? "la" : "eng";
  return text(row[`${prefix}_name_${preferred}`], row[`${prefix}_name`], row[`${prefix}_name_${other}`]);
}

function normalizedName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, "").toLocaleLowerCase();
}

/** Legacy English fields sometimes contain another copy of the Lao name. */
function secondaryName(primary: string, alternate: string, language: string): string {
  if (!alternate || normalizedName(primary) === normalizedName(alternate)) return "";
  const expectedScript = language.toLowerCase().startsWith("en") ? /\p{Script=Lao}/u : /\p{Script=Latin}/u;
  return expectedScript.test(alternate) ? alternate : "";
}

export function isDefaultMenuVariant(label: string): boolean {
  return new Set([
    "", "regular", "general", "default", "standard", "normal",
    "ທົ່ວໄປ", "ປົກກະຕິ", "ມາດຕະຖານ", "ทั่วไป", "ปกติ", "มาตรฐาน",
  ]).has(normalizedName(label));
}

function order(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.POSITIVE_INFINITY;
}

function amount(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const source = String(value).trim();
  // Grouping commas are allowed; malformed amounts must never silently become
  // a different sale price (for example, "2,50" becoming 250).
  if (typeof value !== "number" && !/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(source)) return null;
  const parsed = Number(source.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function priceEntry(id: string, label: string, value: unknown, labels: ProductMenuLabels): MenuPriceEntry {
  const parsed = amount(value);
  return {
    id,
    label,
    amount: parsed,
    priceText: parsed === null
      ? labels.contactPrice
      : `${parsed.toLocaleString("lo-LA", { maximumFractionDigits: 20 })} ₭`,
  };
}

function enabledDetails(product: Product): ProductDetail[] {
  return [...(product.details ?? [])]
    .filter((detail) => String(detail.pro_detail_enabled ?? "1") === "1")
    .sort((left, right) => order(left.pro_detail_sort) - order(right.pro_detail_sort));
}

function setMenuOptions(product: Product, details: ProductDetail[], language: string, labels: ProductMenuLabels): string[] {
  const detailName = (detail: ProductDetail) => localized(detail, "size", language) || labels.regular;
  const groups = [...(product.set_choice_groups ?? [])]
    .sort((left, right) => (Number(left.group_sort) || 0) - (Number(right.group_sort) || 0))
    .map((group) => ({
      id: text(group.set_choice_group_uuid),
      name: localized(group, "group", language),
      limit: Number(group.max_select),
      members: [] as ProductDetail[],
    }))
    .filter((group) => group.id);
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const memberships = new Map<ProductDetail, Set<string>>();
  for (const detail of details) {
    // Deleted group references remain mandatory, matching the order screen.
    const ids = new Set((detail.set_choice_group_uuid_fks ?? []).map((id) => text(id)).filter((id) => groupsById.has(id)));
    memberships.set(detail, ids);
    for (const id of ids) groupsById.get(id)?.members.push(detail);
  }
  if (!groups.some((group) => group.members.length)) return details.map(detailName);

  const options: string[] = [];
  const addedGroups = new Set<string>();
  let included: string[] = [];
  const flushIncluded = () => {
    if (included.length) options.push(`${labels.included ?? "Included"}: ${included.join(", ")}`);
    included = [];
  };
  for (const detail of details) {
    const ids = memberships.get(detail);
    if (!ids?.size) {
      included.push(detailName(detail));
      continue;
    }
    flushIncluded();
    for (const group of groups) {
      if (!ids.has(group.id) || addedGroups.has(group.id)) continue;
      addedGroups.add(group.id);
      // The POS requires exactly this many choices; nonpositive limits default to one.
      const limit = Number.isFinite(group.limit) && group.limit > 0 ? group.limit : 1;
      const choice = labels.chooseCount?.(limit) ?? `Choose ${limit}`;
      const title = group.name ? `${group.name} · ${choice}` : choice;
      options.push(`${title}: ${group.members.map(detailName).join(", ")}`);
    }
  }
  flushIncluded();
  return options;
}

/**
 * Printed menus contain persistent normal/set prices. Promotion records have no
 * independent regular price and can expire after downloading, so they are left
 * out instead of presenting a time-limited offer as a permanent selling price.
 */
export function buildProductMenu(
  products: readonly Product[],
  language: string,
  labels: ProductMenuLabels,
): MenuCategory[] {
  const categories = new Map<string, MenuCategory>();
  const sorted = [...products].sort((left, right) => order(left.prod_sort) - order(right.prod_sort));

  for (const product of sorted) {
    const status = String(product.status_sort_fk ?? "1");
    if (status === "3") continue;
    const details = enabledDetails(product);
    if (!details.length) continue;

    const name = localized(product, "prod", language) || "—";
    const otherName = language.toLowerCase().startsWith("en")
      ? text(product.prod_name_la)
      : text(product.prod_name_eng);
    const categoryName = localized(product, "cate", language) || labels.uncategorized;
    const categoryUuid = text(product.cate_uuid_fk, product.cate_uuid, product.category_uuid_fk);
    // A real category UUID wins over translated names; name-only legacy records
    // remain together without collapsing two different categories with one label.
    const categoryId = categoryUuid
      ? `category:${categoryUuid}`
      : `category-name:${text(product.cate_name_la, product.cate_name_eng, product.cate_name) || "__uncategorized__"}`;
    const id = text(product.prod_uuid, product.prod_code) || `product:${categories.size}:${name}`;
    const isSet = status === "2";
    const imageFilename = [product.prod_image, product.prod_image_raw]
      .map((value) => text(value))
      .find((value) => value && !value.startsWith("#")) ?? "";

    const item: MenuProduct = {
      id,
      number: 0,
      name,
      secondaryName: secondaryName(name, otherName, language),
      categoryId,
      categoryName,
      imageFilename,
      type: isSet ? "set" : "normal",
      prices: isSet
        ? [priceEntry(`${id}:set`, labels.regular, product.prod_set_price, labels)]
        : details.map((detail, index) => priceEntry(
          text(detail.pro_detail_uuid, detail.prod_detail_uuid, detail.product_detail_uuid, detail.detail_uuid, detail.pro_detail_id) || `${id}:size:${index}`,
          localized(detail, "size", language) || labels.regular,
          detail.pro_detail_sprice,
          labels,
        )),
      options: isSet
        ? setMenuOptions(product, details, language, labels)
        : [],
    };

    const category = categories.get(categoryId);
    if (category) category.items.push(item);
    else categories.set(categoryId, { id: categoryId, name: categoryName, items: [item] });
  }
  let itemNumber = 0;
  return [...categories.values()].map((category) => ({
    ...category,
    items: category.items.map((item) => ({ ...item, number: ++itemNumber })),
  }));
}

const textSegmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

function graphemes(value: string): string[] {
  return textSegmenter
    ? Array.from(textSegmenter.segment(value), (part) => part.segment)
    : Array.from(value);
}

function lines(value: string, characters: number): number {
  return value.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(graphemes(line).length / characters)), 0);
}

/** Conservative fallback; export code can supply heights measured with its font. */
export function estimateMenuProductHeight(item: MenuProduct): number {
  const title = lines(item.name, 23) * 22;
  const secondary = item.secondaryName ? lines(item.secondaryName, 30) * 16 : 0;
  const prices = item.prices.reduce((sum, price) => sum + lines(price.label, 20) * 20, 0);
  const options = item.options.reduce((sum, option) => sum + lines(option, 33) * 18, 0);
  return Math.max(78, 24 + title + secondary + prices + options);
}

function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonnegative(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function textChunks(value: string, maxCharacters: number, lineWidth: number): string[] {
  // Lao/Thai combining marks stay attached to their letter across pages.
  const characters = graphemes(value);
  const chunks: string[] = [];
  for (let index = 0; index < characters.length; index += maxCharacters) {
    chunks.push(characters.slice(index, index + maxCharacters).join(""));
  }
  const maxLines = Math.max(2, Math.floor(maxCharacters / lineWidth));
  const splitLines = (chunk: string): string[] => {
    const parts = graphemes(chunk);
    if (lines(chunk, lineWidth) <= maxLines || parts.length < 2) return [chunk];
    const middle = Math.floor(parts.length / 2);
    return [...splitLines(parts.slice(0, middle).join("")), ...splitLines(parts.slice(middle).join(""))];
  };
  return chunks.length ? chunks.flatMap(splitLines) : [""];
}

function splitOversizedProduct(item: MenuProduct, capacity: number, measuredHeight?: number, catalog = false): MenuProduct[] {
  const estimated = estimateMenuProductHeight(item);
  // Dense catalog fonts can render text shorter than the conservative fallback.
  // Honor that measured density while retaining the legacy menu's safe minimum.
  const heightScale = Math.max(catalog ? 0.5 : 1, positive(measuredHeight, estimated) / estimated);
  const budget = capacity / heightScale;
  if (estimated <= budget) return [item];
  if (budget < 78) {
    throw new Error("Menu column is too short to fit a product. Increase its height before exporting.");
  }

  // Even unusually long names and individual option labels keep their complete
  // text. Continuations are explicit records, allowing the renderer to measure
  // them again rather than crop an oversized source record into page images.
  // A catalog repeats the full title on price continuations whenever one title
  // and one price fit. Reserving two thirds of that space splits ordinary dish
  // names into unnecessary title-only cards, especially in wide designs.
  const titleBudget = (budget - 44) / (catalog ? 1 : 3);
  // The first catalog pass can keep an ordinary title through three estimated
  // lines. Real fragment measurements decide whether its title needs splitting;
  // already measured continuations retain the smaller fallback to make progress.
  const minimumNameLimit = catalog && !item.originalId ? 69 : 23;
  const nameLimit = Math.max(minimumNameLimit, Math.floor(titleBudget / 22) * 23);
  const names = textChunks(item.name, nameLimit, 23);
  const fragments: MenuProduct[] = names.map((name) => ({ ...item, name, secondaryName: "", prices: [], options: [] }));
  let current = fragments[fragments.length - 1];
  const repeatName = names.length === 1 ? item.name : names[names.length - 1];
  const next = () => {
    current = { ...item, name: repeatName, secondaryName: "", prices: [], options: [] };
    fragments.push(current);
  };
  const add = (apply: (target: MenuProduct) => void) => {
    const candidate = { ...current, prices: [...current.prices], options: [...current.options] };
    apply(candidate);
    if (estimateMenuProductHeight(candidate) > budget) next();
    apply(current);
  };
  const contentRoom = Math.max(20, budget - 24 - lines(repeatName, 23) * 22);

  if (item.secondaryName) {
    const secondaryLimit = Math.max(30, Math.floor(contentRoom / 16) * 30);
    for (const chunk of textChunks(item.secondaryName, secondaryLimit, 30)) {
      if (current.secondaryName) next();
      add((target) => { target.secondaryName = chunk; });
    }
  }
  const priceLimit = Math.max(20, Math.floor(contentRoom / 20) * 20);
  for (const price of item.prices) {
    textChunks(price.label, priceLimit, 20).forEach((label, index) => {
      add((target) => target.prices.push({ ...price, id: `${price.id}:part:${index}`, label }));
    });
  }
  const optionLimit = Math.max(33, Math.floor(contentRoom / 18) * 33);
  for (const option of item.options) {
    for (const chunk of textChunks(option, optionLimit, 33)) add((target) => target.options.push(chunk));
  }

  return fragments.map((fragment, index) => ({
    ...fragment,
    id: `${item.id}::part:${index + 1}`,
    originalId: item.originalId ?? item.id,
    continued: index > 0 || item.continued,
  }));
}

/** Each category starts a fresh page and keeps its selected number of rows. */
export function paginateProductCatalog(
  categories: readonly MenuCategory[],
  options: ProductCatalogPaginationOptions = {},
): ProductMenuPage[] {
  const columns = options.columns ?? 3;
  const rows = normalizeMenuCatalogRows(options.rows);
  const cardHeight = positive(options.cardHeight, 210);
  const fixedHeight = nonnegative(options.productFixedHeight, 0);
  const contentHeight = cardHeight - fixedHeight;
  const pageSize = columns * rows;
  const pages: ProductMenuPage[] = [];

  for (const category of categories) {
    const pieces = category.items.flatMap((item) => {
      const measuredHeight = options.productHeights?.[item.id];
      const height = positive(measuredHeight, estimateMenuProductHeight(item) + fixedHeight);
      // Whole-card wrapping can exaggerate the inferred text scale. Split down
      // to a minimal estimated card first, then let export measure its fragments.
      const measuredContentHeight = Math.min(
        Math.max(1, height - fixedHeight),
        estimateMenuProductHeight(item) * contentHeight / 80,
      );
      return height > cardHeight
        ? splitOversizedProduct(item, contentHeight, measuredContentHeight, true)
        : [item];
    });
    for (let index = 0; index < pieces.length; index += pageSize) {
      pages.push({
        sections: [{
          id: category.id,
          name: category.name,
          continued: index > 0 || Boolean(pieces[index]?.continued),
          items: pieces.slice(index, index + pageSize),
        }],
      });
    }
  }

  return pages;
}

/** Text menus flow between columns and repeat headings before continued items. */
export function paginateProductMenuColumns(
  categories: readonly MenuCategory[],
  options: ProductMenuColumnsPaginationOptions = {},
): ProductMenuPage[] {
  const columns = options.columns === 2 || options.columns === 3 ? options.columns : 1;
  const defaultCapacity = positive(options.columnHeight, 900);
  const columnCapacities = Array.from({ length: columns }, (_, index) => positive(options.columnHeights?.[index], defaultCapacity));
  // Continuations must also fit when flow reaches the shorter column.
  const minimumCapacity = Math.min(...columnCapacities);
  const headerHeight = positive(options.categoryHeaderHeight, 42);
  const itemGap = nonnegative(options.itemGap, 6);
  const categoryGap = nonnegative(options.categoryGap, 12);
  const maxPhotos = Math.max(1, Math.floor(positive(options.maxPhotosPerPage, Number.POSITIVE_INFINITY)));
  const pages: ProductMenuPage[] = [];
  let page: ProductMenuPage = { sections: [] };
  let column = 0;
  let used = 0;
  const pagePhotos = new Set<string>();
  const advancePage = () => {
    if (page.sections.length) pages.push(page);
    page = { sections: [] };
    column = 0;
    used = 0;
    pagePhotos.clear();
  };
  const advanceColumn = () => {
    if (column + 1 >= columns) advancePage();
    else {
      column += 1;
      used = 0;
    }
  };

  for (const category of categories) {
    if (!category.items.length) continue;
    const categoryHeight = positive(options.categoryHeights?.[category.id], headerHeight);
    const maxItemHeight = minimumCapacity - categoryHeight;
    const pieces = category.items.flatMap((item) => {
      const measuredHeight = options.productHeights?.[item.id];
      return positive(measuredHeight, estimateMenuProductHeight(item)) > maxItemHeight
        ? splitOversizedProduct(item, maxItemHeight, measuredHeight)
        : [item];
    });
    if (used > 0) {
      const heights = pieces.map((item) => positive(options.productHeights?.[item.id], estimateMenuProductHeight(item)));
      const remaining = columnCapacities[column] - used - categoryGap;
      const nextCapacity = columnCapacities[(column + 1) % columns];
      const wholeHeight = categoryHeight + heights.reduce((sum, height) => sum + height, 0)
        + Math.max(0, heights.length - 1) * itemGap;
      const openingHeight = categoryHeight + heights.slice(0, 2).reduce((sum, height) => sum + height, 0)
        + (heights.length > 1 ? itemGap : 0);
      // Keep a short category together, and give a long one at least two items
      // before its first continuation when the next column can hold that pair.
      if ((wholeHeight <= nextCapacity && wholeHeight > remaining)
        || (heights.length > 1 && openingHeight <= nextCapacity && openingHeight > remaining)) {
        advanceColumn();
      }
    }
    let segment: MenuCategorySegment | undefined;
    let placed = false;
    for (const item of pieces) {
      const height = positive(options.productHeights?.[item.id], estimateMenuProductHeight(item));
      if (height + categoryHeight > minimumCapacity) {
        throw new Error("A text menu item exceeds its printable column. Measure continuation records before exporting.");
      }
      const photoId = item.originalId ?? item.id;
      const hasPhoto = Boolean(options.images?.[photoId] || options.images?.[item.id]);
      if (hasPhoto && !pagePhotos.has(photoId) && pagePhotos.size >= maxPhotos) {
        advancePage();
        segment = undefined;
      }
      const extra = segment ? itemGap : (used > 0 ? categoryGap : 0) + categoryHeight;
      if (used + extra + height > columnCapacities[column] && used > 0) {
        advanceColumn();
        segment = undefined;
      }
      if (!segment) {
        if (used > 0) used += categoryGap;
        segment = { id: category.id, name: category.name, continued: placed, column, items: [] };
        page.sections.push(segment);
        used += categoryHeight;
      } else used += itemGap;
      segment.items.push(item);
      used += height;
      placed = true;
      if (hasPhoto) pagePhotos.add(photoId);
    }
  }

  if (page.sections.length) pages.push(page);
  return pages;
}

export function paginateProductMenu(
  categories: readonly MenuCategory[],
  options: ProductMenuPaginationOptions = {},
): ProductMenuPage[] {
  const capacity = positive(options.columnHeight, 900);
  const headerHeight = positive(options.categoryHeaderHeight, 54);
  const itemGap = nonnegative(options.itemGap, 12);
  const categoryGap = nonnegative(options.categoryGap, 20);
  const pages: ProductMenuPage[] = [];
  let page: ProductMenuPage = { sections: [] };
  let used = 0;
  const advance = () => {
    if (page.sections.length) pages.push(page);
    page = { sections: [] };
    used = 0;
  };

  for (const category of categories) {
    if (!category.items.length) continue;
    const categoryHeight = positive(options.categoryHeights?.[category.id], headerHeight);
    const maxItemHeight = capacity - categoryHeight;
    const pieces = category.items.flatMap((item) => {
      const suppliedHeight = options.productHeights?.[item.id];
      const sourceHeight = positive(suppliedHeight, estimateMenuProductHeight(item));
      return sourceHeight > maxItemHeight
        ? splitOversizedProduct(item, maxItemHeight, suppliedHeight)
        : [item];
    });
    const rows: { items: MenuProduct[]; height: number }[] = [];
    for (let index = 0; index < pieces.length; index += 2) {
      const items = pieces.slice(index, index + 2);
      const height = Math.max(...items.map((item) => positive(
        options.productHeights?.[item.id], estimateMenuProductHeight(item),
      )));
      if (height + categoryHeight > capacity) {
        throw new Error("A menu product exceeds the printable page. Measure continuation records before exporting.");
      }
      rows.push({ items, height });
    }

    const wholeHeight = categoryHeight + rows.reduce((height, row) => height + row.height, 0)
      + Math.max(0, rows.length - 1) * itemGap;
    // Keep short categories together. A long category can begin with at least
    // two complete rows, keeping a half-empty sheet useful without orphan headings.
    const firstTwoRowsHeight = categoryHeight + rows.slice(0, 2).reduce((height, row) => height + row.height, 0)
      + (rows.length > 1 ? itemGap : 0);
    if (used > 0 && wholeHeight <= capacity && used + categoryGap + wholeHeight > capacity
      && (rows.length <= 2 || used + categoryGap + firstTwoRowsHeight > capacity)) advance();

    let segment: MenuCategorySegment | undefined;
    let placed = false;
    for (const row of rows) {
      const extra = segment ? itemGap : (used > 0 ? categoryGap : 0) + categoryHeight;
      if (used + extra + row.height > capacity && used > 0) {
        advance();
        segment = undefined;
      }
      if (!segment) {
        if (used > 0) used += categoryGap;
        segment = { id: category.id, name: category.name, continued: placed, items: [] };
        page.sections.push(segment);
        used += categoryHeight;
      } else used += itemGap;
      segment.items.push(...row.items);
      used += row.height;
      placed = true;
    }
  }

  if (page.sections.length) pages.push(page);
  return pages;
}
