import { describe, expect, it } from "vitest";
import {
  getOfflineAllowedPaths,
  getOfflineRedirectPath,
  isOfflineAllowedPath,
} from "./offline-routes";

describe("getOfflineAllowedPaths", () => {
  it("includes order-taking pages for web/electron", () => {
    const paths = getOfflineAllowedPaths(false);
    expect(paths).toContain("/pos/tables");
    expect(paths).toContain("/pos/order");
    expect(paths).toContain("/order_manage");
    expect(paths).toContain("/sales/sales-list");
  });

  it("drops write-capable pages on Android — no Local Printer Agent to sync writes through", () => {
    const paths = getOfflineAllowedPaths(true);
    expect(paths).not.toContain("/pos/tables");
    expect(paths).not.toContain("/pos/order");
    expect(paths).not.toContain("/order_manage");
    expect(paths).toContain("/sales/sales-list");
    expect(paths).toContain("/report/daily-closing");
  });
});

describe("isOfflineAllowedPath", () => {
  it("allows exact matches only, never a prefix", () => {
    expect(isOfflineAllowedPath("/sales/sales-list", false)).toBe(true);
    expect(isOfflineAllowedPath("/sales/cancel-sale", false)).toBe(false);
    expect(isOfflineAllowedPath("/sales/cancel-history", false)).toBe(false);
  });

  it("keeps settings, product, and stock CRUD blocked on every platform", () => {
    expect(isOfflineAllowedPath("/settings/user", false)).toBe(false);
    expect(isOfflineAllowedPath("/products", false)).toBe(false);
    expect(isOfflineAllowedPath("/stock", false)).toBe(false);
  });

  it("always allows infra pages regardless of platform or the essential-page list", () => {
    expect(isOfflineAllowedPath("/login", false)).toBe(true);
    expect(isOfflineAllowedPath("/login", true)).toBe(true);
    expect(isOfflineAllowedPath("/pos", true)).toBe(true);
  });

  it("blocks order-taking pages on Android specifically", () => {
    expect(isOfflineAllowedPath("/pos/order", false)).toBe(true);
    expect(isOfflineAllowedPath("/pos/order", true)).toBe(false);
  });
});

describe("getOfflineRedirectPath", () => {
  it("sends web/electron to Open Table, and Android to a read-only report page", () => {
    expect(getOfflineRedirectPath(false)).toBe("/pos/tables");
    expect(getOfflineRedirectPath(true)).toBe("/sales/sales-list");
  });

  it("never redirects to a path it would immediately reject", () => {
    expect(isOfflineAllowedPath(getOfflineRedirectPath(false), false)).toBe(true);
    expect(isOfflineAllowedPath(getOfflineRedirectPath(true), true)).toBe(true);
  });
});
