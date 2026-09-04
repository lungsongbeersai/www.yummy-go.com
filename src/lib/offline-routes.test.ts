import { describe, expect, it } from "vitest";
import {
  getOfflineAllowedPaths,
  getOfflineRedirectPath,
  isOfflineAllowedPath,
} from "./offline-routes";
import { supportsOfflineRoute } from "@/services/offline-sync";

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

  it("opens master-data pages for reading, since the Agent projects them locally", () => {
    // Readable, not editable: the create/update/delete routes for these pages are
    // absent from OFFLINE_ROUTES, and useOfflineReadOnly takes their controls away.
    for (const path of ["/settings/user", "/settings/branch", "/products", "/stock"]) {
      expect(isOfflineAllowedPath(path, false)).toBe(true);
    }
  });

  it("still keeps master-data writes off the offline transport", () => {
    for (const route of [
      ["post", "/api/v1/product/create"],
      ["post", "/api/v1/product/delete"],
      ["post", "/api/v1/register/create"],
      ["post", "/api/v1/branch/delete"],
    ] as const) {
      expect(supportsOfflineRoute(route[0], route[1])).toBe(false);
    }
    // The reads those pages need are offline-capable, which is why they can open.
    for (const path of [
      "/api/v1/product/fetch_limit",
      "/api/v1/product/stock_qty",
      "/api/v1/register/fetch_limit",
      "/api/v1/branch/fetch_all",
    ]) {
      expect(supportsOfflineRoute("get", path)).toBe(true);
    }
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
