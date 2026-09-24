import { describe, expect, it } from "vitest";
import { shouldUnoptimizeProductImage } from "@/lib/pos/product-media";

describe("product image optimization", () => {
  it("uses Next image optimization for configured production paths", () => {
    expect(
      shouldUnoptimizeProductImage(
        "https://api.yummy-go.com/uploaded/products/menu.webp",
      ),
    ).toBe(false);
    expect(
      shouldUnoptimizeProductImage(
        "https://plc-files.sgp1.vultrobjects.com/api.yummy-go.com/products/menu.webp",
      ),
    ).toBe(false);
  });

  it("bypasses optimization for origins not allowed by remotePatterns", () => {
    expect(
      shouldUnoptimizeProductImage("http://127.0.0.1:5005/uploaded/menu.webp"),
    ).toBe(true);
    expect(
      shouldUnoptimizeProductImage("https://images.example.test/menu.webp"),
    ).toBe(true);
  });
});
