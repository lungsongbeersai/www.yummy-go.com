import { describe, expect, it } from "vitest";
import { publicProductColorTint, shouldUnoptimizeProductImage } from "@/lib/pos/product-media";

describe("public product color tint", () => {
  it("preserves the same translucent paint for shorthand and full API colors", () => {
    expect(publicProductColorTint("#A3f")).toBe("rgba(170, 51, 255, 0.12)");
    expect(publicProductColorTint("#aa33ff")).toBe(publicProductColorTint("#A3f"));
    expect(publicProductColorTint("#000000")).toBe("rgba(0, 0, 0, 0.12)");
  });

  it.each(["red", "#abcd", "#aabbccdd", "#12", "#ffffff);color:red", " #fff"])("rejects colors outside the public menu's API contract: %s", (value) => {
    expect(publicProductColorTint(value)).toBeNull();
  });
});

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
