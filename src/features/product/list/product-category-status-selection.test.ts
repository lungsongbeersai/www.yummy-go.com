import { describe, expect, it } from "vitest";
import { createProductCategoryStatusSelection } from "./product-category-status-selection";

describe("product category status selection", () => {
  it("resolves a retained category when entering the list, then keeps its tab on later reloads", () => {
    const selection = createProductCategoryStatusSelection();
    const initial = selection.begin("branch-1:food-sets");
    expect(initial.needsResolution).toBe(true);
    expect(selection.complete(initial)).toBe(true);

    // Pagination, search, ordering and refresh retain the same category scope.
    expect(selection.begin("branch-1:food-sets").needsResolution).toBe(false);
  });

  it("resolves again when changing category or branch", () => {
    const selection = createProductCategoryStatusSelection();
    selection.complete(selection.begin("branch-1:food-sets"));
    expect(selection.begin("branch-1:drinks").needsResolution).toBe(true);
    expect(selection.begin("branch-2:food-sets").needsResolution).toBe(true);
  });

  it("resolves a category again after leaving it for all categories", () => {
    const selection = createProductCategoryStatusSelection();
    selection.complete(selection.begin("branch-1:food-sets"));
    selection.complete(selection.begin("branch-1:all"));
    expect(selection.begin("branch-1:food-sets").needsResolution).toBe(true);
  });

  it("does not let a slow prior category choose the current tab", () => {
    const selection = createProductCategoryStatusSelection();
    const oldRequest = selection.begin("branch-1:food-sets");
    const currentRequest = selection.begin("branch-1:drinks");
    expect(selection.complete(oldRequest)).toBe(false);
    expect(selection.complete(currentRequest)).toBe(true);
  });

  it("lets a manual tab selection cancel a pending category choice, including the current tab", () => {
    const selection = createProductCategoryStatusSelection();
    const pending = selection.begin("branch-1:food-sets");
    selection.selectManually("branch-1:food-sets");
    expect(selection.isCurrent(pending)).toBe(false);
    expect(selection.complete(pending)).toBe(false);
    expect(selection.begin("branch-1:food-sets").needsResolution).toBe(false);
  });

  it("retries an unresolved category after a failed request", () => {
    const selection = createProductCategoryStatusSelection();
    selection.begin("branch-1:food-sets");
    expect(selection.begin("branch-1:food-sets").needsResolution).toBe(true);
  });

  it("ignores results after route cleanup", () => {
    const selection = createProductCategoryStatusSelection();
    const pending = selection.begin("branch-1:food-sets");
    selection.cancel();
    expect(selection.complete(pending)).toBe(false);
  });
});
