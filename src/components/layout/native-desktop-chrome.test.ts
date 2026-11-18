import { describe, expect, it } from "vitest";
import { shouldUseNativeDesktopChrome } from "./native-desktop-chrome";

const desktop = {
  wideLandscape: true,
  pathname: "/",
  desktopHomeLayout: false,
  desktopPosLayout: false,
};

describe("shouldUseNativeDesktopChrome", () => {
  it.each(["/", "/products", "/settings/branch", "/report/daily-sales"])(
    "shares browser chrome for the wide native back office at %s",
    (pathname) => {
      expect(shouldUseNativeDesktopChrome({ ...desktop, pathname })).toBe(true);
    },
  );

  it("keeps native chrome when the viewport is narrow or portrait", () => {
    expect(shouldUseNativeDesktopChrome({ ...desktop, wideLandscape: false })).toBe(false);
  });

  it.each(["/posAll/order", "/posAll/tables"])(
    "preserves the native POS workspace at %s on a wide screen",
    (pathname) => {
      expect(shouldUseNativeDesktopChrome({ ...desktop, pathname })).toBe(false);
    },
  );

  it("preserves the measured Swan 1 desktop home layout", () => {
    expect(shouldUseNativeDesktopChrome({ ...desktop, desktopHomeLayout: true })).toBe(false);
  });

  it("preserves the measured Swan 1 desktop POS layout", () => {
    expect(shouldUseNativeDesktopChrome({ ...desktop, desktopPosLayout: true })).toBe(false);
  });
});
