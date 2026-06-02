import { isAllPageLimit, pageLimitNumber } from "@/lib/pagination";
import type { BestSellingProductsReportResponse } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export interface BestSellingProductItem extends ApiEntity {
  billDiscountShare: number;
  categoryName: string;
  charge: number;
  finalTotal: number;
  groupId: string;
  groupName: string;
  id: string;
  itemDiscount: number;
  productCode: string;
  productName: string;
  qty: number;
  rank: number;
  salePrice: number;
  subtotal: number;
  vat: number;
}

export interface BestSellingProductGroup {
  billDiscountShare: number;
  charge: number;
  finalTotal: number;
  id: string;
  itemDiscount: number;
  items: BestSellingProductItem[];
  name: string;
  productCount: number;
  qtyTotal: number;
  subtotal: number;
  vat: number;
}

export interface BestSellingProductsPagination {
  limit: PageLimit;
  page: number;
  total: number;
  totalPages: number;
}

export interface BestSellingProductsReportData {
  filters: ApiEntity;
  groups: BestSellingProductGroup[];
  pagination: BestSellingProductsPagination;
  rows: BestSellingProductItem[];
  summary: ApiEntity;
}

function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): ApiEntity {
  return isRecord(value) ? value : {};
}

function asRecords(value: unknown): ApiEntity[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function textValue(value: unknown, fallback = "-") {
  return isPresent(value) ? String(value) : fallback;
}

function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (!isPresent(value)) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function firstOptionalNumber(...values: unknown[]) {
  for (const value of values) {
    if (!isPresent(value)) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function responseRoot(response: BestSellingProductsReportResponse) {
  return isRecord(response.data) && !Array.isArray(response.data)
    ? response.data
    : response;
}

function normalizeLimit(value: unknown, fallback: PageLimit): PageLimit {
  if (value === "All" || value === "all") return "All";
  const number = firstOptionalNumber(value);
  return number ?? fallback;
}

function reportSection(root: ApiEntity) {
  return asRecord(root.report);
}

function reportSummary(root: ApiEntity, rows: BestSellingProductItem[], groups: BestSellingProductGroup[]) {
  const report = reportSection(root);
  const summary = asRecord(
    report.summary ?? root.summary ?? root.report_summary ?? root.summary_cards
  );
  if (Object.keys(summary).length) return summary;

  return {
    bill_discount_share: rows.reduce((total, row) => total + row.billDiscountShare, 0),
    charge: rows.reduce((total, row) => total + row.charge, 0),
    final_total: rows.reduce((total, row) => total + row.finalTotal, 0),
    group_count: groups.length,
    item_discount: rows.reduce((total, row) => total + row.itemDiscount, 0),
    product_count: rows.length,
    qty: rows.reduce((total, row) => total + row.qty, 0),
    subtotal: rows.reduce((total, row) => total + row.subtotal, 0),
    vat: rows.reduce((total, row) => total + row.vat, 0)
  };
}

function groupName(row: ApiEntity, container: ApiEntity, fallback: string) {
  return textValue(
    readValue(row, [
      "group_name",
      "group_name_la",
      "group_name_eng",
      "name",
      "title"
    ]) ??
      readValue(container, [
        "group_name",
        "group_name_la",
        "group_name_eng",
        "name",
        "title"
      ]),
    fallback
  );
}

function groupId(row: ApiEntity, container: ApiEntity, fallback: string) {
  return textValue(
    readValue(row, ["group_uuid", "group_uuid_fk", "uuid", "id"]) ??
      readValue(container, ["group_uuid", "group_uuid_fk", "uuid", "id"]),
    fallback
  );
}

function productName(row: ApiEntity) {
  return textValue(
    readValue(row, [
      "product_name",
      "prod_name",
      "prod_name_la",
      "prod_name_eng",
      "name"
    ])
  );
}

function productCode(row: ApiEntity) {
  return textValue(readValue(row, ["prod_code", "product_code", "code"]), "-");
}

function categoryName(row: ApiEntity) {
  return textValue(readValue(row, ["cate_name", "category_name", "category", "cate_name_la", "cate_name_eng"]));
}

function productId(row: ApiEntity, group: ApiEntity, index: number) {
  const id = textValue(
    readValue(row, [
      "product_uuid",
      "prod_uuid",
      "pro_uuid",
      "product_uuid_fk",
      "prod_detail_uuid",
      "prod_detail_uuid_fk",
      "id"
    ]),
    ""
  );
  const groupKey = textValue(readValue(group, ["group_uuid", "group_uuid_fk", "id"]), "");
  return id ? `${groupKey}:${id}` : `${groupKey}:${productCode(row)}:${productName(row)}:${index}`;
}

function itemQty(row: ApiEntity) {
  return firstNumber(
    readValue(row, [
      "qty",
      "qty_total",
      "quantity",
      "sold_quantity",
      "total_qty",
      "sale_qty"
    ])
  );
}

function itemFinalTotal(row: ApiEntity) {
  return firstNumber(
    readValue(row, [
      "final_total",
      "revenue_total",
      "total",
      "net_total",
      "line_total",
      "amount"
    ])
  );
}

function itemSalePrice(row: ApiEntity) {
  return firstNumber(readValue(row, ["sale_price", "sprice", "price", "prod_price"]));
}

function itemSubtotal(row: ApiEntity) {
  return firstNumber(readValue(row, ["subtotal", "sub_total", "gross_total"]));
}

function itemDiscount(row: ApiEntity) {
  return firstNumber(readValue(row, ["item_discount", "item_discount_amount", "discount"]));
}

function itemBillDiscountShare(row: ApiEntity) {
  return firstNumber(readValue(row, ["bill_discount_share", "bill_discount", "bill_discount_amount"]));
}

function itemCharge(row: ApiEntity) {
  return firstNumber(readValue(row, ["charge", "service_charge", "service_charge_amount"]));
}

function itemVat(row: ApiEntity) {
  return firstNumber(readValue(row, ["vat", "vat_amount", "tax"]));
}

function normalizeItem(
  row: ApiEntity,
  group: ApiEntity,
  container: ApiEntity,
  itemIndex: number,
  fallbackRank: number
): BestSellingProductItem {
  const name = groupName(group, container, "-");
  const id = groupId(group, container, name);

  return {
    ...row,
    billDiscountShare: itemBillDiscountShare(row),
    categoryName: categoryName(row),
    charge: itemCharge(row),
    finalTotal: itemFinalTotal(row),
    groupId: id,
    groupName: name,
    id: productId(row, group, itemIndex),
    itemDiscount: itemDiscount(row),
    productCode: productCode(row),
    productName: productName(row),
    qty: itemQty(row),
    rank: firstNumber(readValue(row, ["rank", "no", "index"]), fallbackRank),
    salePrice: itemSalePrice(row),
    subtotal: itemSubtotal(row),
    vat: itemVat(row)
  };
}

function groupMetric(row: ApiEntity, key: string, items: BestSellingProductItem[], itemKey: keyof BestSellingProductItem) {
  const summary = asRecord(row.summary);
  return (
    firstOptionalNumber(readValue(row, [key]), readValue(summary, [key])) ??
    items.reduce((total, item) => total + Number(item[itemKey] ?? 0), 0)
  );
}

function normalizeGroup(
  row: ApiEntity,
  container: ApiEntity,
  groupIndex: number,
  rankOffset: number
): BestSellingProductGroup {
  const items = asRecords(row.items).map((item, itemIndex) =>
    normalizeItem(item, row, container, itemIndex, rankOffset + itemIndex + 1)
  );
  const name = groupName(row, container, `Group ${groupIndex + 1}`);
  const id = groupId(row, container, name);
  const summary = asRecord(row.summary);
  const qtyTotal =
    firstOptionalNumber(
      readValue(row, ["qty", "qty_total", "total_qty", "quantity"]),
      readValue(summary, ["qty", "qty_total", "total_qty", "quantity"])
    ) ?? items.reduce((total, item) => total + item.qty, 0);
  const finalTotal =
    firstOptionalNumber(
      readValue(row, ["final_total", "total", "revenue_total", "amount"]),
      readValue(summary, ["final_total", "total", "revenue_total", "amount"])
    ) ?? items.reduce((total, item) => total + item.finalTotal, 0);

  return {
    billDiscountShare: groupMetric(row, "bill_discount_share", items, "billDiscountShare"),
    charge: groupMetric(row, "charge", items, "charge"),
    finalTotal,
    id,
    itemDiscount: groupMetric(row, "item_discount", items, "itemDiscount"),
    items,
    name,
    productCount:
      firstOptionalNumber(
        readValue(row, ["product_count", "products_count", "count"])
      ) ?? items.length,
    qtyTotal,
    subtotal: groupMetric(row, "subtotal", items, "subtotal"),
    vat: groupMetric(row, "vat", items, "vat")
  };
}

function dataContainers(root: ApiEntity, response: BestSellingProductsReportResponse) {
  const report = reportSection(root);
  const responseRows = root === response ? [] : asRecords(response.data);
  const candidates = [
    ...asRecords(root.data),
    ...asRecords(report.data),
    ...responseRows
  ];
  return candidates.length ? candidates : [root];
}

function normalizeGroups(root: ApiEntity, response: BestSellingProductsReportResponse) {
  const groups: BestSellingProductGroup[] = [];

  dataContainers(root, response).forEach((container) => {
    const containerGroups = asRecords(container.groups);
    if (containerGroups.length) {
      containerGroups.forEach((group) => {
        const rankOffset = groups.reduce((total, current) => total + current.items.length, 0);
        groups.push(normalizeGroup(group, container, groups.length, rankOffset));
      });
      return;
    }

    if (asRecords(container.items).length) {
      const rankOffset = groups.reduce((total, current) => total + current.items.length, 0);
      groups.push(normalizeGroup(container, {}, groups.length, rankOffset));
    }
  });

  if (!groups.length) {
    asRecords(root.groups).forEach((group) => {
      const rankOffset = groups.reduce((total, current) => total + current.items.length, 0);
      groups.push(normalizeGroup(group, root, groups.length, rankOffset));
    });
  }

  return mergeBestSellingProductGroups(groups);
}

export function mergeBestSellingProductGroups(groups: BestSellingProductGroup[]) {
  const byGroup = new Map<string, BestSellingProductGroup>();

  groups.forEach((group) => {
    const current = byGroup.get(group.id);
    if (!current) {
      byGroup.set(group.id, { ...group, items: [...group.items] });
      return;
    }

    current.items.push(...group.items);
    current.billDiscountShare += group.billDiscountShare;
    current.charge += group.charge;
    current.qtyTotal += group.qtyTotal;
    current.finalTotal += group.finalTotal;
    current.itemDiscount += group.itemDiscount;
    current.productCount += group.productCount;
    current.subtotal += group.subtotal;
    current.vat += group.vat;
  });

  return Array.from(byGroup.values()).map((group) => ({
    ...group,
    items: group.items.sort((left, right) => left.rank - right.rank)
  }));
}

export function bestSellingTotalPages(
  root: ApiEntity,
  pagination: ApiEntity,
  total: number,
  limit: PageLimit,
  page: number
) {
  if (isAllPageLimit(limit)) return 1;
  const explicit = firstOptionalNumber(
    pagination.totalPages,
    pagination.total_pages,
    pagination.total_page,
    pagination.totalPage,
    root.totalPages,
    root.total_pages,
    root.total_page,
    root.totalPage
  );
  if (explicit !== null) return Math.max(1, explicit);
  const numericLimit = pageLimitNumber(limit);
  return total > 0 && numericLimit > 0 ? Math.max(1, Math.ceil(total / numericLimit)) : Math.max(1, page);
}

export function normalizeBestSellingProductsReportResponse(
  response: BestSellingProductsReportResponse,
  fallbackLimit: PageLimit = 20,
  fallbackPage = 1
): BestSellingProductsReportData {
  const root = responseRoot(response);
  const paginationRoot = asRecord(root.pagination ?? response.pagination);
  const groups = normalizeGroups(root, response);
  const rows = groups.flatMap((group) => group.items).sort((left, right) => left.rank - right.rank);
  const page = firstOptionalNumber(paginationRoot.page, root.page) ?? fallbackPage;
  const limit = normalizeLimit(paginationRoot.limit ?? root.limit, fallbackLimit);
  const total =
    firstOptionalNumber(
      paginationRoot.total,
      paginationRoot.totalRows,
      paginationRoot.total_rows,
      root.total,
      root.totalRows,
      root.total_rows,
      root.count
    ) ?? rows.length;

  return {
    filters: asRecord(root.filters ?? response.filters),
    groups,
    pagination: {
      limit,
      page,
      total,
      totalPages: bestSellingTotalPages(root, paginationRoot, total, limit, page)
    },
    rows,
    summary: reportSummary(root, rows, groups)
  };
}
