import { describe, expect, it } from "vitest";
import {
  canonicalRoute,
  internalRoute,
  isSafeInternalPath,
} from "@/lib/routes";

describe("canonicalRoute", () => {
  it("maps P2.1 renamed sections to their current paths", () => {
    expect(canonicalRoute("/setting")).toBe("/settings");
    expect(canonicalRoute("/setting/store")).toBe("/settings/store");
    expect(canonicalRoute("/setting/manage-access-permissions")).toBe(
      "/settings/manage-access-permissions"
    );
    expect(canonicalRoute("/product")).toBe("/products");
    expect(canonicalRoute("/product/create")).toBe("/products/create");
    expect(canonicalRoute("/printer")).toBe("/printers");
    expect(canonicalRoute("/printer/setup")).toBe("/printers/setup");
  });

  it("maps the POS screens moved out of the sales section", () => {
    expect(canonicalRoute("/sales/open-table-sale")).toBe("/pos/tables");
    expect(canonicalRoute("/sale/order-customer")).toBe("/pos/order");
    expect(canonicalRoute("/sale/counter-checkout")).toBe("/sales/sales-list");
  });

  it("maps the inherited unite typo before the generic /setting rule", () => {
    expect(canonicalRoute("/setting/unite")).toBe("/settings/unit");
  });

  it("leaves paths that were never renamed untouched", () => {
    expect(canonicalRoute("/")).toBe("/");
    expect(canonicalRoute("/stock")).toBe("/stock");
    expect(canonicalRoute("/settings/store")).toBe("/settings/store");
    expect(canonicalRoute("/report/daily-sales")).toBe("/report/daily-sales");
    expect(canonicalRoute("/sales/sales-list")).toBe("/sales/sales-list");
  });

  it("does not rewrite paths that merely share a prefix", () => {
    expect(canonicalRoute("/settings")).toBe("/settings");
    expect(canonicalRoute("/products")).toBe("/products");
    expect(canonicalRoute("/printers")).toBe("/printers");
    expect(canonicalRoute("/settingx")).toBe("/settingx");
    expect(canonicalRoute("/productions")).toBe("/productions");
  });

  it("passes through empty and non-internal values unchanged", () => {
    expect(canonicalRoute("")).toBe("");
    expect(canonicalRoute("https://example.com/setting")).toBe("https://example.com/setting");
  });
});

describe("internalRoute", () => {
  it("keeps internal paths and rejects external or browser-normalized paths", () => {
    expect(internalRoute("/settings/store")).toBe("/settings/store");
    expect(internalRoute("//evil.com")).toBe("/");
    expect(internalRoute("/\\evil.com")).toBe("/");
    expect(internalRoute("/safe\npath")).toBe("/");
    expect(internalRoute("/safe\u202Epath")).toBe("/");
    expect(internalRoute("https://evil.com")).toBe("/");
  });

  it("resolves legacy menu paths so links skip the redirect hop", () => {
    expect(internalRoute("/setting/store")).toBe("/settings/store");
  });
});

describe("isSafeInternalPath", () => {
  it("accepts one leading slash and rejects backslashes and control characters", () => {
    expect(isSafeInternalPath("/")).toBe(true);
    expect(isSafeInternalPath("/products?search=noodle#top")).toBe(true);
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("/\\evil.com")).toBe(false);
    expect(isSafeInternalPath("/safe\u0000path")).toBe(false);
    expect(isSafeInternalPath("/safe\u202Epath")).toBe(false);
  });
});
