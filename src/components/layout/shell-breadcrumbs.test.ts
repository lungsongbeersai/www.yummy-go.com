import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import { resolveShellBreadcrumbs } from "./shell-breadcrumbs";

const items: MenuItem[] = [
  {
    path: "/settings",
    title: "settings",
    children: [{ path: "/settings/category", title: "category" }],
  },
  {
    path: "/report",
    title: "reports",
    children: [{ path: "/report/daily-sales", title: "daily-sales" }],
  },
  {
    path: "/sale",
    title: "sales",
    children: [{ path: "/sales/sales-list", title: "sales-list" }],
  },
];

describe("resolveShellBreadcrumbs", () => {
  it("keeps the real settings index route clickable for child pages", () => {
    expect(resolveShellBreadcrumbs(items, "/settings/category")).toEqual([
      expect.objectContaining({ path: "/settings", title: "settings" }),
      expect.objectContaining({
        path: "/settings/category",
        title: "category",
      }),
    ]);
  });

  it("does not link permission groups that have no real page", () => {
    expect(resolveShellBreadcrumbs(items, "/report/daily-sales")?.[0]).toEqual(
      expect.objectContaining({ path: undefined, title: "reports" }),
    );
    expect(resolveShellBreadcrumbs(items, "/sales/sales-list")?.[0]).toEqual(
      expect.objectContaining({ path: undefined, title: "sales" }),
    );
  });
});
