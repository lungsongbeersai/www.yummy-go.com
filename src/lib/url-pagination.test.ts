import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import { parseUrlPagination } from "@/lib/url-pagination";

describe("url pagination", () => {
  it("parses valid page and limit params", () => {
    expect(parseUrlPagination(new URLSearchParams("page=2&limit=50"))).toEqual({
      page: 2,
      limit: 50,
    });
  });

  it("falls back to page 1 for invalid page params", () => {
    expect(parseUrlPagination(new URLSearchParams("page=-1")).page).toBe(1);
    expect(parseUrlPagination(new URLSearchParams("page=abc")).page).toBe(1);
  });

  it("falls back to the default limit for invalid limit params", () => {
    expect(parseUrlPagination(new URLSearchParams("limit=abc")).limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(parseUrlPagination(new URLSearchParams("limit=10")).limit).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("keeps All when it is allowed", () => {
    expect(parseUrlPagination(new URLSearchParams("limit=All")).limit).toBe("All");
  });

  it("respects page-specific allowed limits", () => {
    expect(parseUrlPagination(new URLSearchParams("limit=All"), { limitOptions: [20, 50] }).limit).toBe(20);
    expect(parseUrlPagination(new URLSearchParams("limit=50"), { limitOptions: [20, 50] }).limit).toBe(50);
  });
});
