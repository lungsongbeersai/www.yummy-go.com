import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_QUERY_PARAM,
  WINDOW_OPEN_FONT_STYLESHEET_HREF,
  WINDOW_OPEN_FONT_STYLESHEET_LINK,
  WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT,
  withWindowOpenFonts,
} from "./window-open-fonts";

const fontsDirectory = resolve(process.cwd(), "public/fonts");

describe("window-open fonts", () => {
  it("uses Saysettha only for Lao and Times for remaining characters", () => {
    const css = readFileSync(resolve(fontsDirectory, "window-open-fonts.css"), "utf8");

    expect(css).toContain('url("./saysettha_ot.ttf")');
    expect(css).toContain("unicode-range: U+0E80-0EFF");
    expect(css).toContain('url("./times.ttf")');
    expect(css).toContain(
      'font-family: "Yummy Go Saysettha OT", "Yummy Go Times New Roman", "Times New Roman", serif !important;',
    );
    expect(statSync(resolve(fontsDirectory, "saysettha_ot.ttf")).size).toBeGreaterThan(0);
    expect(statSync(resolve(fontsDirectory, "times.ttf")).size).toBeGreaterThan(0);
  });

  it("provides shared popup markup and waits for fonts before printing", () => {
    expect(WINDOW_OPEN_FONT_CLASS_NAME).toBe("window-open-fonts");
    expect(WINDOW_OPEN_FONT_STYLESHEET_HREF).toMatch(/\/fonts\/window-open-fonts\.css$/);
    expect(WINDOW_OPEN_FONT_STYLESHEET_LINK).toContain(WINDOW_OPEN_FONT_STYLESHEET_HREF);
    expect(WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT).toContain("document.fonts?.ready");
  });

  it("marks only supported app URLs for the window-open font mode", () => {
    const currentOrigin = "http://localhost:3000";
    const productionOrigin = "https://yummy-go.com";

    expect(withWindowOpenFonts("/pos?t=one", currentOrigin)).toBe(
      `${currentOrigin}/pos?t=one&${WINDOW_OPEN_FONT_QUERY_PARAM}=1`,
    );
    expect(withWindowOpenFonts(`${productionOrigin}/q/two`, currentOrigin, [productionOrigin])).toBe(
      `${productionOrigin}/q/two?${WINDOW_OPEN_FONT_QUERY_PARAM}=1`,
    );
    expect(withWindowOpenFonts("https://external.example/pos", currentOrigin, [productionOrigin])).toBe(
      "https://external.example/pos",
    );
  });
});
