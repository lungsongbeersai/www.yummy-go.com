import { describe, expect, it } from "vitest";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

describe("safeInternalRedirect", () => {
  it.each([
    "/",
    "/product",
    "/product?page=2&limit=20",
    "/product?search=green%20tea#results",
  ])("keeps the internal path %s", (value) => {
    expect(safeInternalRedirect(value)).toBe(value);
  });

  it.each([
    ["missing value", null],
    ["empty value", ""],
    ["relative path", "product"],
    ["JavaScript URL", "javascript:alert(1)"],
    ["data URL", "data:text/html,<script>alert(1)</script>"],
    ["external HTTPS URL", "https://attacker.example/product"],
    ["protocol-relative URL", "//attacker.example/product"],
    ["backslash network path", "/\\attacker.example/product"],
    ["encoded protocol-relative URL", "%2F%2Fattacker.example/product"],
    [
      "decoded protocol-relative query value",
      new URLSearchParams("redirect=%2F%2Fattacker.example/product").get("redirect"),
    ],
    ["raw control character", "/product\njavascript:alert(1)"],
    ["encoded control character", "/product%0Ajavascript:alert(1)"],
  ])("falls back for %s", (_case, value) => {
    expect(safeInternalRedirect(value)).toBe("/");
  });
});
