import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DESIGN_SYSTEM } from "@/design-system/config";

describe("DESIGN_SYSTEM", () => {
  it("declares the shadcn token stylesheet", () => {
    expect(DESIGN_SYSTEM.tokens.stylesheet).toBe("src/app/globals.css");
  });

  it("declares supported theme modes", () => {
    expect(DESIGN_SYSTEM.theme.modes).toEqual(["light", "dark"]);
  });

  it("exposes semantic font variables", () => {
    expect(DESIGN_SYSTEM.fonts.sans).toEqual({
      variable: "--font-sans",
      utility: "font-sans",
    });
    expect(DESIGN_SYSTEM.fonts.lao).toEqual({
      variable: "--font-noto-sans-lao",
      utility: "font-lao",
    });
  });

  it("maps the Lao font into a semantic Tailwind token", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), DESIGN_SYSTEM.tokens.stylesheet), "utf8");

    expect(stylesheet).toContain("--font-lao: var(--font-noto-sans-lao);");
  });

  it("applies shared font variables from the root layout", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(layout).toContain('import { appFontVariables } from "@/design-system/fonts";');
    expect(layout).toContain('initialLanguage === "la" ? "font-lao" : "font-sans"');
  });

  it("uses literal values required by next/font", () => {
    const fonts = readFileSync(resolve(process.cwd(), "src/design-system/fonts.ts"), "utf8");

    expect(fonts).toContain('variable: "--font-sans"');
    expect(fonts).toContain('variable: "--font-noto-sans-lao"');
  });

  it("loads the bundled Lao font locally", () => {
    const fonts = readFileSync(resolve(process.cwd(), "src/design-system/fonts.ts"), "utf8");

    expect(fonts).toContain('import localFont from "next/font/local"');
    expect(fonts).toContain('NotoSansLao-VariableFont_wdth,wght.ttf');
  });

  it("loads the bundled English font locally", () => {
    const fonts = readFileSync(resolve(process.cwd(), "src/design-system/fonts.ts"), "utf8");

    expect(fonts).toContain('NotoSans-VariableFont_wdth,wght.ttf');
  });
});
