import { describe, expect, it } from "vitest";
import { normalizeProductImagePayload, saveProductPayload } from "@/services/product/payload";

describe("product payload helpers", () => {
  it("extracts uploaded file names from absolute image URLs", () => {
    expect(normalizeProductImagePayload("https://api.yummy-go.com/uploads/food%201.png")).toBe("food 1.png");
  });

  it("keeps color swatches as product image payloads", () => {
    expect(normalizeProductImagePayload("#ffcc00")).toBe("#ffcc00");
  });

  it("removes empty product uuid and stringifies nested arrays", () => {
    const payload = saveProductPayload({
      prod_uuid: " ",
      prod_name_la: "Coffee",
      details: [{ size_uuid_fk: "s1", pro_detail_bprice: 1, pro_detail_qty_stock: 0, pro_detail_stock: 1 }],
      toppings: [{ topping_uuid_fk: "t1", topping_price: 2 }]
    });

    expect(payload.prod_uuid).toBeUndefined();
    expect(payload.details).toBe(JSON.stringify([{ size_uuid_fk: "s1", pro_detail_bprice: 1, pro_detail_qty_stock: 0, pro_detail_stock: 1 }]));
    expect(payload.toppings).toBe(JSON.stringify([{ topping_uuid_fk: "t1", topping_price: 2 }]));
  });

  it("drops empty image strings", () => {
    expect(saveProductPayload({ prod_image: "" }).prod_image).toBeUndefined();
  });
});
