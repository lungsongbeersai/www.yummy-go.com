import { money } from "@/lib/format";
import type { Category } from "@/services/category";
import { getProductImageUrl, type Product, type ProductDetail, type StatusSort } from "@/services/product";

export type ProductStockSummary = "deduct" | "noDeduct" | "mixed";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function binaryFlag(value: unknown, fallback: "1" | "2" = "2") {
  return String(value ?? fallback) === "1" ? "1" : "2";
}

export function firstText(row: Record<string, unknown> | null | undefined, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return fallback;
}

export function productName(row: Product, language: string) {
  return language.startsWith("en")
    ? firstText(row, ["prod_name_eng", "prod_name", "prod_name_la"], "-")
    : firstText(row, ["prod_name_la", "prod_name", "prod_name_eng"], "-");
}

export function categoryName(row: Product, language: string) {
  return language.startsWith("en")
    ? firstText(row, ["cate_name_eng", "cate_name", "cate_name_la"], "-")
    : firstText(row, ["cate_name_la", "cate_name", "cate_name_eng"], "-");
}

export function categoryUuid(row: Category) {
  return firstText(row, ["cate_uuid", "cate_uuid_fk", "category_uuid", "category_uuid_fk"]);
}

export function categoryOptionName(row: Category, language: string) {
  return language.startsWith("en")
    ? firstText(row, ["cate_name_eng", "cate_name", "cate_name_la"], "-")
    : firstText(row, ["cate_name_la", "cate_name", "cate_name_eng"], "-");
}

export function unitName(row: Product, language: string) {
  return language.startsWith("en")
    ? firstText(row, ["unite_name_eng", "unite_name", "unite_name_la"], "-")
    : firstText(row, ["unite_name_la", "unite_name", "unite_name_eng"], "-");
}

export function productDetailUuid(detail: ProductDetail) {
  const explicit = firstText(detail, ["pro_detail_uuid", "prod_detail_uuid", "product_detail_uuid", "detail_uuid"]);
  if (explicit) return explicit;

  const detailId = String(detail.pro_detail_id ?? "").trim();
  return UUID_PATTERN.test(detailId) ? detailId : "";
}

export function productDetails(row: Product) {
  return Array.isArray(row.details) ? row.details.filter((detail) => productDetailUuid(detail)) : [];
}

export function detailLabel(detail: ProductDetail, index: number, language: string) {
  const name = language.startsWith("en")
    ? detail.size_name_eng || detail.size_name || detail.size_name_la
    : detail.size_name_la || detail.size_name || detail.size_name_eng;
  return String(name || `#${index + 1}`);
}

export function isHexColor(value: string) {
  return HEX_COLOR.test(value.trim());
}

export function productColor(row: Product) {
  const image = String(row.prod_image ?? "").trim();
  const raw = String(row.prod_image_raw ?? "").trim();
  const value = image.startsWith("#") ? image : raw.startsWith("#") ? raw : "";
  return isHexColor(value) ? value : "";
}

export function productImageSrc(row: Product) {
  const image = String(row.prod_image ?? "").trim();
  const raw = String(row.prod_image_raw ?? "").trim();
  const source = image && !image.startsWith("#") ? image : raw && !raw.startsWith("#") ? raw : "";
  return source ? getProductImageUrl(source) : "";
}

export function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function productPriceLabel(row: Product) {
  if (String(row.status_sort_fk ?? "") === "2" && numberValue(row.prod_set_price) > 0) {
    return money(row.prod_set_price);
  }

  const prices = productDetails(row)
    .map((detail) => numberValue(detail.pro_detail_sprice))
    .filter((price) => price > 0);

  if (!prices.length) return "-";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? money(min) : `${money(min)} - ${money(max)}`;
}

export function totalStockQty(row: Product) {
  return productDetails(row).reduce((total, detail) => total + numberValue(detail.pro_detail_qty_stock ?? detail.qty_stock), 0);
}

export function productOrderPoint(row: Product) {
  return numberValue(row.prod_order_point);
}

export function detailStockQty(detail: ProductDetail) {
  return numberValue(detail.pro_detail_qty_stock ?? detail.qty_stock);
}

export function detailStockSummary(details: ProductDetail[]): ProductStockSummary {
  const stockModes = details.map((detail) => binaryFlag(detail.pro_detail_stock, "1"));
  if (!stockModes.length || stockModes.every((value) => value === "1")) return "deduct";
  if (stockModes.every((value) => value === "2")) return "noDeduct";
  return "mixed";
}

export function statusSortValue(status: StatusSort, fallback: number) {
  const raw = status.status_sort ?? status.status_sort_fk ?? status.id ?? fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

export function statusSortLabel(
  status: StatusSort,
  language: string,
  fallbackTabs: { value: string; label: string }[],
  value: string
) {
  const fallback = fallbackTabs.find((tab) => tab.value === value)?.label ?? value;
  return language.startsWith("en")
    ? firstText(status, ["status_name_eng", "status_name", "status_name_la"], fallback)
    : firstText(status, ["status_name_la", "status_name", "status_name_eng"], fallback);
}

export function shortDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.includes("T") ? text.slice(0, 10) : text;
}

export function shortTime(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 5 ? text.slice(0, 5) : text;
}
