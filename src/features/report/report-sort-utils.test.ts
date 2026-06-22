import { describe, expect, it } from "vitest";
import {
  nextLocalSortState,
  reportOrderOptions,
  sortRowsLocally,
} from "./report-sort-utils";

const t = (key: string) => key;

describe("report sort helpers", () => {
  it("builds shared API order options from locale keys", () => {
    expect(reportOrderOptions(t)).toEqual([
      { label: "common.highLow", value: "DESC" },
      { label: "common.lowHigh", value: "ASC" },
    ]);
  });

  it("cycles local sort state through ASC, DESC, and reset", () => {
    const asc = nextLocalSortState(null, "name");
    expect(asc).toEqual({ key: "name", direction: "ASC" });
    const desc = nextLocalSortState(asc, "name");
    expect(desc).toEqual({ key: "name", direction: "DESC" });
    expect(nextLocalSortState(desc, "name")).toBeNull();
    expect(nextLocalSortState(desc, "total")).toEqual({
      key: "total",
      direction: "ASC",
    });
  });

  it("sorts numbers, dates, strings, and empty values locally", () => {
    const rows: Array<Record<string, string | number>> = [
      { date: "2026-06-19", name: "Beer 10", total: "2,000 ₭" },
      { date: "", name: "Beer 2", total: "" },
      { date: "2026-06-18", name: "Apple", total: 1000 },
    ];

    expect(
      sortRowsLocally(rows, { key: "total", direction: "ASC" }, (row, key) => row[key]),
    ).toEqual([rows[2], rows[0], rows[1]]);
    expect(
      sortRowsLocally(rows, { key: "date", direction: "DESC" }, (row, key) => row[key]),
    ).toEqual([rows[0], rows[2], rows[1]]);
    expect(
      sortRowsLocally(rows, { key: "name", direction: "ASC" }, (row, key) => row[key]),
    ).toEqual([rows[2], rows[1], rows[0]]);
  });

  it("keeps original row order on reset and never mutates the source array", () => {
    const rows: Array<Record<string, number>> = [{ total: 2 }, { total: 1 }];
    const sortedRows = sortRowsLocally(
      rows,
      { key: "total", direction: "ASC" },
      (row, key) => row[key],
    );

    expect(sortedRows).toEqual([rows[1], rows[0]]);
    expect(rows).toEqual([{ total: 2 }, { total: 1 }]);
    expect(sortRowsLocally(rows, null, (row, key) => row[key])).toEqual(rows);
  });
});
