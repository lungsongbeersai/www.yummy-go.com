import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_HREF,
  WINDOW_OPEN_FONT_STYLESHEET_LINK,
  WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT,
} from "./window-open-fonts";

const fontsDirectory = resolve(process.cwd(), "public/fonts");

describe("window-open fonts", () => {
  it("uses Noto Sans Lao only for Lao and Times for remaining characters", () => {
    const css = readFileSync(resolve(fontsDirectory, "window-open-fonts.css"), "utf8");

    expect(css).toContain('url("./NotoSansLao.ttf")');
    expect(css).toContain("unicode-range: U+0E80-0EFF");
    expect(css).toContain('url("./times.ttf")');
    expect(css).toContain(
      'font-family: "Yummy Go Noto Sans Lao", "Yummy Go Times New Roman", "Times New Roman", serif !important;',
    );
    expect(statSync(resolve(fontsDirectory, "NotoSansLao.ttf")).size).toBeGreaterThan(0);
    expect(statSync(resolve(fontsDirectory, "times.ttf")).size).toBeGreaterThan(0);
  });

  it("provides shared popup markup and waits for fonts before printing", () => {
    expect(WINDOW_OPEN_FONT_CLASS_NAME).toBe("window-open-fonts");
    expect(WINDOW_OPEN_FONT_STYLESHEET_HREF).toMatch(/\/fonts\/window-open-fonts\.css$/);
    expect(WINDOW_OPEN_FONT_STYLESHEET_LINK).toContain(WINDOW_OPEN_FONT_STYLESHEET_HREF);
    expect(WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT).toContain("document.fonts?.ready");
  });
});
