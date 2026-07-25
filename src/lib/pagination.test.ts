import { describe, expect, it } from "vitest";
import { isAllPageLimit, pageLimitNumber, pageLimitSize, pageRange, pageTotalPages } from "@/lib/pagination";

describe("isAllPageLimit", () => {
  it("recognizes the All sentinel only", () => {
    expect(isAllPageLimit("All")).toBe(true);
    expect(isAllPageLimit(20)).toBe(false);
    expect(isAllPageLimit(undefined)).toBe(false);
  });
});

describe("pageLimitNumber", () => {
  it("passes through a positive numeric limit", () => {
    expect(pageLimitNumber(50)).toBe(50);
  });

  it("falls back for non-finite or non-positive limits", () => {
    expect(pageLimitNumber(0)).toBe(20);
    expect(pageLimitNumber(undefined)).toBe(20);
    expect(pageLimitNumber(undefined, 10)).toBe(10);
  });
});

describe("pageLimitSize", () => {
  it("uses the row count for All, falling back when empty", () => {
    expect(pageLimitSize("All", 7)).toBe(7);
    expect(pageLimitSize("All", 0)).toBe(20);
  });

  it("uses the numeric limit otherwise", () => {
    expect(pageLimitSize(50, 7)).toBe(50);
  });
});

describe("pageTotalPages", () => {
  it("uses the API-reported total pages when present", () => {
    expect(pageTotalPages(3, 100, 20)).toBe(3);
  });

  it("falls back to a ceil computation when totalPages is 0", () => {
    expect(pageTotalPages(0, 45, 20)).toBe(3);
  });

  it("never returns fewer than 1 page", () => {
    expect(pageTotalPages(0, 0, 20)).toBe(1);
  });
});

describe("pageRange", () => {
  it("computes the 1-based start/end for the current page", () => {
    expect(pageRange(20, 2, 20)).toEqual({ start: 21, end: 40 });
  });

  it("returns zeros when there are no rows", () => {
    expect(pageRange(0, 1, 20)).toEqual({ start: 0, end: 0 });
  });

  it("stops end at the last row on a partial page", () => {
    expect(pageRange(5, 3, 20)).toEqual({ start: 41, end: 45 });
  });
});
