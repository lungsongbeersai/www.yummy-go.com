import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CategorySalesReportOrder,
  DailySalesReportOrder,
  PaymentMethodReportOrder,
} from "@/services/report";

export type ReportOrder =
  | DailySalesReportOrder
  | CategorySalesReportOrder
  | PaymentMethodReportOrder;

export type LocalSortDirection = "ASC" | "DESC";

export type LocalSortState<TKey extends string = string> = {
  direction: LocalSortDirection;
  key: TKey;
} | null;

export const REPORT_ORDER_OPTIONS = [
  "DESC",
  "ASC",
] as const satisfies readonly ReportOrder[];

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function reportOrderOptions(t: (key: string) => string) {
  return REPORT_ORDER_OPTIONS.map((value) => ({
    label: t(value === "ASC" ? "common.lowHigh" : "common.highLow"),
    value,
  }));
}

export function nextLocalSortState<TKey extends string>(
  current: LocalSortState<TKey>,
  key: TKey,
): LocalSortState<TKey> {
  if (!current || current.key !== key) return { key, direction: "ASC" };
  if (current.direction === "ASC") return { key, direction: "DESC" };
  return null;
}

export function sortRowsLocally<TItem, TKey extends string>(
  rows: TItem[],
  sort: LocalSortState<TKey>,
  getValue: (row: TItem, key: TKey) => unknown,
) {
  const indexedRows = rows.map((row, index) => ({ index, row }));
  if (!sort) return indexedRows.map((item) => item.row);

  const direction = sort.direction === "ASC" ? 1 : -1;

  return indexedRows
    .sort((left, right) => {
      const compared = compareLocalSortValues(
        getValue(left.row, sort.key),
        getValue(right.row, sort.key),
        direction,
      );
      return compared === 0 ? left.index - right.index : compared;
    })
    .map((item) => item.row);
}

export function useLocalTableSort<TItem, TKey extends string>(
  rows: TItem[],
  getValue: (row: TItem, key: TKey) => unknown,
) {
  const [sort, setSort] = useState<LocalSortState<TKey>>(null);

  useEffect(() => {
    setSort(null);
  }, [rows]);

  const sortedRows = useMemo(
    () => sortRowsLocally(rows, sort, getValue),
    [getValue, rows, sort],
  );
  const toggleSort = useCallback((key: TKey) => {
    setSort((current) => nextLocalSortState(current, key));
  }, []);

  return { sort, sortedRows, toggleSort };
}

function compareLocalSortValues(
  left: unknown,
  right: unknown,
  direction: 1 | -1,
) {
  const leftValue = normalizeSortValue(left);
  const rightValue = normalizeSortValue(right);

  if (leftValue.empty !== rightValue.empty) {
    return leftValue.empty ? 1 : -1;
  }
  if (leftValue.empty && rightValue.empty) return 0;

  if (leftValue.kind === "number" && rightValue.kind === "number") {
    return (leftValue.value - rightValue.value) * direction;
  }
  if (leftValue.kind === "date" && rightValue.kind === "date") {
    return (leftValue.value - rightValue.value) * direction;
  }

  return (
    collator.compare(String(leftValue.value), String(rightValue.value)) *
    direction
  );
}

function normalizeSortValue(value: unknown):
  | { empty: true; kind: "empty"; value: "" }
  | { empty: false; kind: "number"; value: number }
  | { empty: false; kind: "date"; value: number }
  | { empty: false; kind: "string"; value: string } {
  if (value === null || value === undefined || value === "") {
    return { empty: true, kind: "empty", value: "" };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { empty: false, kind: "number", value };
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return { empty: false, kind: "date", value: value.getTime() };
  }

  const text = String(value).trim();
  if (!text) return { empty: true, kind: "empty", value: "" };

  const numeric = Number(text.replace(/[,\s]/g, "").replace(/[^0-9.+-]/g, ""));
  if (Number.isFinite(numeric)) {
    return { empty: false, kind: "number", value: numeric };
  }

  const timestamp = Date.parse(text);
  if (Number.isFinite(timestamp) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    return { empty: false, kind: "date", value: timestamp };
  }

  return { empty: false, kind: "string", value: text.toLocaleLowerCase() };
}
