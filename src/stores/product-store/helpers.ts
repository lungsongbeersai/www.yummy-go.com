import type {
  Product,
  ProductDetail,
  ProductStockModePatch,
  ProductStatusFieldsPatch
} from "@/services/product";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function firstText(row: Record<string, unknown> | null | undefined, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return fallback;
}

export function productDetailUuid(detail: ProductDetail) {
  const explicit = firstText(detail, ["pro_detail_uuid", "prod_detail_uuid", "product_detail_uuid", "detail_uuid"]);
  if (explicit) return explicit;

  const detailId = String(detail.pro_detail_id ?? "").trim();
  return UUID_PATTERN.test(detailId) ? detailId : "";
}

export function applyProductStatusFields(rows: Product[], input: ProductStatusFieldsPatch) {
  const enabledByDetail = new Map(
    input.enabled?.map((row) => [row.pro_detail_uuid, row.pro_detail_enabled]) ?? []
  );
  const stockByDetail = new Map(
    input.stockModes?.map((row) => [row.pro_detail_uuid, row.pro_detail_stock]) ?? []
  );

  let anyChanged = false;
  const nextRows = rows.map((row) => {
    let changed = false;
    let next: Product = row;

    if (input.notification?.prod_uuid === row.prod_uuid) {
      next = { ...next, prod_notification: input.notification.prod_notification };
      changed = true;
    }

    if (Array.isArray(row.details) && (enabledByDetail.size || stockByDetail.size)) {
      const details = row.details.map((detail) => {
        const detailUuid = productDetailUuid(detail);
        const patch: Record<string, unknown> = {};

        if (enabledByDetail.has(detailUuid)) patch.pro_detail_enabled = enabledByDetail.get(detailUuid);
        if (stockByDetail.has(detailUuid)) patch.pro_detail_stock = stockByDetail.get(detailUuid);

        if (!Object.keys(patch).length) return detail;
        changed = true;
        return { ...detail, ...patch };
      });
      next = { ...next, details };
    }

    if (changed) anyChanged = true;
    return changed ? next : row;
  });
  return anyChanged ? nextRows : rows;
}

export function upsertProduct(rows: Product[], product: Product) {
  if (!product?.prod_uuid) return rows;
  const index = rows.findIndex((row) => row.prod_uuid === product.prod_uuid);
  if (index < 0) return [product, ...rows];

  return rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...product } : row));
}

export function responseField(response: Record<string, unknown>, key: string, fallback: unknown) {
  const data = response.data;
  if (data && typeof data === "object" && key in data) {
    return (data as Record<string, unknown>)[key];
  }
  return response[key] ?? fallback;
}

export function responseNumber(response: Record<string, unknown>, key: string, fallback: number) {
  const value = Number(responseField(response, key, fallback));
  return Number.isFinite(value) ? value : fallback;
}

export function stockModesFromResponse(response: Record<string, unknown>, fallback: ProductStockModePatch[]) {
  const byDetail = new Map(fallback.map((row) => [row.pro_detail_uuid, row.pro_detail_stock]));
  const data = response.data;
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? [data]
      : firstText(response, ["pro_detail_uuid", "prod_detail_uuid", "product_detail_uuid", "detail_uuid"]) ||
          UUID_PATTERN.test(String(response.pro_detail_id ?? "").trim())
        ? [response]
        : [];

  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const record = row as Record<string, unknown>;
    const detailUuid =
      firstText(record, ["pro_detail_uuid", "prod_detail_uuid", "product_detail_uuid", "detail_uuid"]) ||
      (UUID_PATTERN.test(String(record.pro_detail_id ?? "").trim()) ? String(record.pro_detail_id).trim() : "");
    const stockMode = Number(record.pro_detail_stock);
    if (detailUuid && Number.isFinite(stockMode)) byDetail.set(detailUuid, stockMode);
  });

  return Array.from(byDetail, ([pro_detail_uuid, pro_detail_stock]) => ({
    pro_detail_uuid,
    pro_detail_stock
  }));
}

export function patchProduct(rows: Product[], prodUuid: string, patch: Partial<Product>) {
  let changed = false;
  const nextRows = rows.map((row) => {
    if (row.prod_uuid !== prodUuid) return row;
    changed = true;
    return { ...row, ...patch };
  });
  return changed ? nextRows : rows;
}

export function patchDetail(rows: Product[], detailUuid: string, patch: Partial<ProductDetail>) {
  let changed = false;
  const nextRows = rows.map((row) => {
    if (!Array.isArray(row.details)) return row;

    let rowChanged = false;
    const details = row.details.map((detail) => {
      if (productDetailUuid(detail) !== detailUuid) return detail;
      rowChanged = true;
      changed = true;
      return { ...detail, ...patch };
    });

    return rowChanged ? { ...row, details } : row;
  });
  return changed ? nextRows : rows;
}
