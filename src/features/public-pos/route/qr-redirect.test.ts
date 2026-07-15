import { describe, expect, it } from "vitest";
import { WINDOW_OPEN_FONT_QUERY_PARAM } from "@/lib/window-open-fonts";
import { publicPosRedirectUrl } from "./qr-redirect";

describe("publicPosRedirectUrl", () => {
  it("preserves the window-open font mode", () => {
    expect(publicPosRedirectUrl("token value", `?${WINDOW_OPEN_FONT_QUERY_PARAM}=1`)).toBe(
      `/pos?t=token+value&${WINDOW_OPEN_FONT_QUERY_PARAM}=1`,
    );
  });

  it("keeps normal QR redirects unchanged", () => {
    expect(publicPosRedirectUrl("token", "")).toBe("/pos?t=token");
  });
});
