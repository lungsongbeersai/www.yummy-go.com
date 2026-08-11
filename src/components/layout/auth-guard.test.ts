import { describe, expect, it } from "vitest";
import { unauthenticatedEntryPath } from "@/components/layout/auth-guard";

describe("unauthenticatedEntryPath", () => {
  it("sends native users directly to login with the requested POS route", () => {
    expect(unauthenticatedEntryPath("/pos/tables", true)).toBe(
      "/login?redirect=%2Fpos%2Ftables"
    );
  });

  it("keeps the public marketing entry on the web", () => {
    expect(unauthenticatedEntryPath("/report/daily-sales", false)).toBe(
      "/home?redirect=%2Freport%2Fdaily-sales"
    );
  });
});
