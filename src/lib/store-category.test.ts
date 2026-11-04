import { describe, expect, it } from "vitest";
import { normalizeStoreCategory, STORE_CATEGORIES } from "./store-category";

describe("store categories", () => {
  it("keeps every supported business category", () => {
    for (const category of STORE_CATEGORIES) {
      expect(normalizeStoreCategory(category)).toBe(category);
    }
  });

  it("defaults legacy and invalid category values to restaurant", () => {
    for (const category of [undefined, null, "", "unknown", 3]) {
      expect(normalizeStoreCategory(category)).toBe("restaurant");
    }
  });
});
