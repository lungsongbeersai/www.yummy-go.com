import { describe, expect, it } from "vitest";
import { publicPosRedirectUrl } from "./qr-redirect";

describe("publicPosRedirectUrl", () => {
  it("redirects QR tokens without adding page-level font overrides", () => {
    expect(publicPosRedirectUrl("token value")).toBe("/pos?t=token+value");
  });
});
