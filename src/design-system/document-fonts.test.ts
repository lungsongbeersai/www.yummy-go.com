import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fontsDirectory = resolve(process.cwd(), "public/fonts");
const faces = readFileSync(resolve(fontsDirectory, "app-document-font-faces.css"), "utf8");
const documentStyles = readFileSync(resolve(fontsDirectory, "app-document-fonts.css"), "utf8");

describe("isolated document font stylesheet contract", () => {
  it("makes face aliases available to the PDF canvas without styling the application", () => {
    const declarations = [...faces.matchAll(/@font-face\s*\{([^}]+)\}/g)];
    expect(declarations).toHaveLength(7);
    const remainder = faces.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@font-face\s*\{[^}]+\}/g, "").trim();
    expect(remainder).toBe("");
    expect(documentStyles.trimStart()).toMatch(/^@import url\("\.\/app-document-font-faces\.css"\);/);
    expect(documentStyles).not.toContain("@font-face");
  });

  it("uses existing bundled assets and allows the selected face's own Latin and digit glyphs", () => {
    const paths = [...faces.matchAll(/url\("\.\/([^"\n]+)"\)/g)].map((match) => match[1]);
    expect(paths).toHaveLength(6);
    for (const path of paths) expect(statSync(resolve(fontsDirectory, path)).size).toBeGreaterThan(10_000);
    expect(faces.match(/src:\s*local\("Arial"\)/g)).toHaveLength(1);
    expect(faces).not.toMatch(/unicode-range\s*:/i);
  });

  it("matches the application's regular and bold face weight registrations", () => {
    const registrations = [...faces.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(([, block]) => ({
      family: /font-family:\s*"([^"]+)"/.exec(block)?.[1],
      weight: /font-weight:\s*([^;]+)/.exec(block)?.[1],
    }));
    expect(registrations).toEqual([
      { family: "App Document Noto Sans", weight: undefined },
      { family: "App Document Noto Sans Lao", weight: undefined },
      { family: "App Document Noto Serif Lao", weight: "100 900" },
      { family: "App Document Phetsarath", weight: "400" },
      { family: "App Document Phetsarath", weight: "700" },
      { family: "App Document Saysettha", weight: "400" },
      { family: "App Document Phetsarath Fallback", weight: undefined },
    ]);
  });

  it("keeps selected Lao glyphs first and uses the app's Arial fallback for Phetsarath Latin", () => {
    const phetsarath = /html\[data-lao-font="phetsarath"\]\s*\{([^}]+)\}/.exec(documentStyles)?.[1];
    expect(phetsarath).toContain('--font-lao-ui: "App Document Phetsarath"');
    expect(phetsarath).toContain('--font-document-fallback: "App Document Phetsarath Fallback"');
    expect(documentStyles).toContain('--font-document-fallback: "App Document Noto Sans"');
    expect(documentStyles).toContain("font-family: var(--font-lao-ui), var(--font-document-fallback), sans-serif");
    const localFace = [...faces.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(([, block]) => block).find((block) => block.includes('"App Document Phetsarath Fallback"'));
    expect(localFace).not.toMatch(/font-(?:weight|style)\s*:/);
  });
});
