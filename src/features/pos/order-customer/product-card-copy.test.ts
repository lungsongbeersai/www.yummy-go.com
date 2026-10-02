import { describe, expect, it } from "vitest";
import { productCardCopy, productCardRadiusClass } from "./product-card-copy";

describe("product card platform copy", () => {
  it("uses the compact action and removes the variable-price hint on native mobile", () => {
    expect(productCardCopy(true)).toEqual({
      chooseActionKey: "pos.mobileOptionsAction",
      showVariablePriceHint: false,
    });
  });

  it("preserves the existing action and removes the variable-price hint on web/desktop", () => {
    expect(productCardCopy(false)).toEqual({
      chooseActionKey: "pos.chooseOptionsAction",
      showVariablePriceHint: false,
    });
  });

  it("uses an 8px radius only on native mobile cards", () => {
    expect(productCardRadiusClass(true)).toBe("rounded-md");
    expect(productCardRadiusClass(false)).toBe("rounded-xl");
  });
});
