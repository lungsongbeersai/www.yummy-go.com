import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss, { type Declaration, type Plugin, type Root } from "postcss";
import { transform as compileCss } from "lightningcss";
import tailwindPostcss from "@tailwindcss/postcss";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const legacyWebViewOpacity = require(
  "../../scripts/postcss-legacy-webview-opacity.cjs",
) as () => Plugin;
const legacyWebViewGeometry = require("../../scripts/postcss-legacy-webview-geometry.cjs") as () => Plugin;
const legacyWebViewLayers = require("../../scripts/postcss-legacy-webview-layers.cjs") as () => Plugin;

interface LegacyColor {
  channels: string[];
  alpha: string;
}

interface ColorCompiler {
  colorChannels: (value: string, tokens: Set<string>) => LegacyColor | null;
  transformValue: (value: string, tokens: Set<string>) => string;
}

const { createColorCompiler } = require("../../scripts/legacy-color-values.cjs") as {
  createColorCompiler: (transform: typeof compileCss) => ColorCompiler;
};

function nativeDeclarations(root: Root, property: string) {
  const declarations: Declaration[] = [];
  root.walkRules((rule) => {
    if (!rule.selector.includes(":where(.capacitor-android")) return;
    rule.walkDecls(property, (declaration) => { declarations.push(declaration); });
  });
  return declarations;
}

function channelVariables(root: Root, selectors: string[]) {
  const result: Record<string, string> = {};
  const normalize = (selector: string) => selector.replace(/=(["'])([\w-]+)\1(?=\])/g, "=$2");
  for (const selector of selectors) {
    root.walkRules((rule) => {
      if (normalize(rule.selector) !== normalize(selector)) return;
      rule.walkDecls(/^--legacy-/, (declaration) => { result[declaration.prop.slice(2)] = declaration.value; });
    });
  }
  return result;
}

function compileLegacyColor(value: string, variables: Record<string, string>) {
  for (let count = 0; count < 20 && value.includes("var("); count++) {
    value = value.replace(/var\(--([\w-]+)(?:,\s*([^()]*))?\)/g, (_, token: string, fallback: string | undefined) => {
      const replacement = variables[token] ?? fallback;
      if (!replacement) throw new Error(`Missing color variable ${token}`);
      return replacement;
    });
  }
  const css = new TextDecoder().decode(compileCss({
    filename: "legacy-color-fixture.css",
    code: new TextEncoder().encode(`a{color:${value}}`),
    targets: { chrome: 88 << 16 },
    minify: true,
  }).code);
  return /color:([^;}]+)/.exec(css)?.[1];
}

describe("Android color compatibility", () => {
  it("uses the sRGB theme and palette on every Capacitor Android device", () => {
    const globals = readFileSync(
      fileURLToPath(new URL("../app/globals.css", import.meta.url)),
      "utf8",
    );
    const paymentContent = readFileSync(
      fileURLToPath(new URL(
        "../features/pos/table-selection/payment-dialog-content.tsx",
        import.meta.url,
      )),
      "utf8",
    );
    const paymentComponents = readFileSync(
      fileURLToPath(new URL(
        "../features/pos/table-selection/payment-dialog-components.tsx",
        import.meta.url,
      )),
      "utf8",
    );

    expect(globals).toContain("html.capacitor-android {");
    expect(globals).toContain("html.capacitor-android.dark {");
    expect(globals).toContain("html.capacitor-android[data-theme-color=\"emerald\"]");
    expect(globals).toContain(".capacitor-android {\n  /* Use deterministic sRGB palette values");
    expect(globals).toContain(
      ".capacitor-android [data-slot=\"sheet-content\"][data-pos-pattern]",
    );
    expect(globals).toContain("rgba(var(--legacy-primary-rgb), 0.45)");
    expect(globals).toContain(
      '.capacitor-android [data-pos-payment-amount-surface="true"]',
    );
    expect(globals).not.toContain("html.swan1-legacy-colors[data-theme-color=");
    expect(paymentContent).toContain('data-pos-payment-amount-surface="true"');
    expect(paymentContent).toContain("border-0 bg-muted text-right");
    expect(paymentComponents).toContain(
      'data-pos-payment-amount-surface={active ? "true" : undefined}',
    );
    expect(paymentComponents).toContain(
      'active && "border-primary/70 bg-muted ring-2 ring-primary/20 hover:bg-muted"',
    );
  });

  it.each([
    ["table-cashier", "#2563eb", "37, 99, 235"],
    ["table-staff", "#9333ea", "147, 51, 234"],
    ["table-payment", "#0d9488", "13, 148, 136"],
  ])("keeps %s status tints translucent on Android", async (token, color, channels) => {
    const selector = `.bg-${token}\\/8`;
    const input = `
      :root { --${token}: ${color}; }
      ${selector} { background-color: var(--${token}); }
      @supports (color: color-mix(in lab, red, red)) {
        ${selector} {
          background-color: color-mix(in oklab, var(--${token}) 8%, transparent);
        }
      }
    `;

    const result = await postcss([legacyWebViewOpacity()]).process(input, { from: undefined });

    expect(result.css).toContain(`--legacy-${token}-rgb: ${channels}`);
    expect(result.css).toContain(`.capacitor-android ${selector}`);
    expect(result.css).toContain(
      `rgba(var(--legacy-${token}-rgb), calc(var(--legacy-${token}-alpha) * 0.08))`,
    );
  });

  it("adds translucent color fallbacks for every Capacitor Android device", async () => {
    const input = `
      :root { --primary: #007956; }
      .bg-primary\\/45 { background-color: var(--primary); }
      @supports (color: color-mix(in lab, red, red)) {
        .bg-primary\\/45 {
          background-color: color-mix(in oklab, var(--primary) 45%, transparent);
        }
      }
    `;

    const result = await postcss([legacyWebViewOpacity()]).process(input, {
      from: undefined,
    });

    expect(result.css).toContain(".capacitor-android .bg-primary\\/45");
    expect(result.css).toContain(
      "rgba(var(--legacy-primary-rgb), calc(var(--legacy-primary-alpha) * 0.45))",
    );
    expect(result.css).not.toContain(".swan1-legacy-colors .bg-primary\\/45");
  });

  it.each([
    ["rgb(20 40 60 / 25%)", ["20", "40", "60"], "0.25"],
    ["rgba(20, 40, 60, 0.5)", ["20", "40", "60"], "0.5"],
    ["hsl(0 100% 50% / 50%)", ["255", "0", "0"], "0.5"],
    ["hsla(0, 100%, 50%, 0.5)", ["255", "0", "0"], "0.5"],
    ["oklch(0.508 0.118 165.612 / 20%)", ["0", "121", "86"], "0.2"],
    ["transparent", ["0", "0", "0"], "0"],
  ])("preserves channels and authored alpha for %s", (input, channels, alpha) => {
    const compiler = createColorCompiler(compileCss);
    expect(compiler.colorChannels(input, new Set())).toEqual({ channels, alpha });
  });

  it("discovers translucent semantic aliases beyond the original token allowlist", async () => {
    const result = await postcss([legacyWebViewOpacity()]).process(`
      :root { --custom-alias: var(--custom-tint); --custom-tint: rgb(20 40 60 / 25%); }
      .selected { background: color-mix(in oklab, var(--custom-alias) 20%, transparent); }
    `, { from: undefined });
    const background = nativeDeclarations(result.root, "background")[0];
    expect(compileLegacyColor(background.value, channelVariables(result.root, [":root"]))).toBe("#14283c0d");
    expect(result.css).toContain("--legacy-custom-alias-alpha: var(--legacy-custom-tint-alpha)");
  });

  it("mixes translucent button colors using premultiplied alpha and retains hover/state/media/important", async () => {
    const result = await postcss([legacyWebViewOpacity()]).process(`
      :root { --card: rgba(255, 0, 0, 0.5); --primary-text: #0000ff; }
      @media (hover: hover) {
        @supports (color: color-mix(in lab, red, red)) {
          .header:hover, .header[aria-expanded="true"] {
            background-color: color-mix(in oklch, var(--card), var(--primary-text) 50%) !important;
          }
        }
      }
    `, { from: undefined });
    const declaration = nativeDeclarations(result.root, "background-color")[0];
    expect(declaration.important).toBe(true);
    expect(compileLegacyColor(declaration.value, channelVariables(result.root, [":root"]))).toBe("#5500aabf");
    expect(declaration.parent?.toString()).toContain(".header:hover");
    expect(declaration.parent?.toString()).toContain('.header[aria-expanded="true"]');
    expect(declaration.parent?.parent?.type).toBe("atrule");
    expect(declaration.parent?.parent?.parent?.toString()).toContain("@media (hover: hover)");
    expect(result.css).toContain("not (color: color-mix(in srgb, black, white))");
    expect(result.css).toContain("background-color: color-mix(in oklch, var(--card), var(--primary-text) 50%) !important");
  });

  it("keeps dark and alternate theme colors tied to their tokens", async () => {
    const result = await postcss([legacyWebViewOpacity()]).process(`
      :root { --warning: hsl(38 92% 46%); --primary: #007956; }
      .dark { --warning: hsl(38 92% 55%); }
      [data-theme-color="violet"] { --primary: #6d28d9; }
      .warning { background: color-mix(in oklab, var(--warning) 20%, transparent); }
      .active { border-color: color-mix(in oklab, var(--primary) 50%, transparent); }
    `, { from: undefined });
    const warning = nativeDeclarations(result.root, "background")[0];
    const active = nativeDeclarations(result.root, "border-color")[0];
    expect(compileLegacyColor(warning.value, channelVariables(result.root, [":root"]))).toBe("#e1920933");
    expect(compileLegacyColor(warning.value, channelVariables(result.root, [":root", ".dark"]))).toBe("#f6a82333");
    expect(compileLegacyColor(active.value, channelVariables(result.root, [":root", '[data-theme-color="violet"]']))).toBe("#6d28d980");
  });

  it("converts custom toast variables, gradients and nested shadow opacity without modern color functions", async () => {
    const result = await postcss([legacyWebViewOpacity()]).process(`
      :root {
        --success: #00ff00; --popover: #ffffff;
        --toast-success-bg: color-mix(in oklch, var(--success) 12%, var(--popover));
      }
      .surface {
        background: linear-gradient(90deg, color-mix(in srgb, var(--success) 25%, transparent), transparent);
        --tw-shadow-color: color-mix(in oklab, color-mix(in oklab, var(--success) 20%, transparent) var(--tw-shadow-alpha), transparent);
      }
    `, { from: undefined });
    const tint = nativeDeclarations(result.root, "--toast-success-bg")[0];
    const shadow = nativeDeclarations(result.root, "--tw-shadow-color")[0];
    const variables = channelVariables(result.root, [":root"]);
    expect(compileLegacyColor(tint.value, variables)).toBe("#e0ffe0");
    expect(compileLegacyColor(shadow.value, { ...variables, "tw-shadow-alpha": "50%" })).toBe("#00ff001a");
    expect(nativeDeclarations(result.root, "background")[0].value).not.toContain("color-mix(");
  });

  it("keeps sub-100% mix weights translucent and produces valid channels when both operands are transparent", async () => {
    const result = await postcss([legacyWebViewOpacity()]).process(`
      :root { --tint: rgba(255, 0, 0, 0.5); --clear: transparent; }
      .light { color: color-mix(in oklab, var(--tint) 40%, var(--clear) 40%); }
      .clear { background: color-mix(in srgb, var(--clear), var(--clear)); }
    `, { from: undefined });
    const variables = channelVariables(result.root, [":root"]);
    expect(compileLegacyColor(nativeDeclarations(result.root, "color")[0].value, variables)).toBe("#f003");
    expect(compileLegacyColor(nativeDeclarations(result.root, "background")[0].value, variables)).toBe("#0000");
  });

  it("uses separate native animation aliases so keyframe color fallbacks do not change browser animations", async () => {
    const result = await postcss([legacyWebViewOpacity()]).process(`
      :root { --warning: #ff0000; }
      @keyframes warn { from { background: color-mix(in oklch, var(--warning) 20%, transparent); } to { opacity: 1; } }
      .alert { animation: warn 1s ease infinite; }
    `, { from: undefined });
    expect(result.css).toContain("@keyframes warn {");
    expect(result.css).toContain("@keyframes warn-yummy-android-srgb");
    expect(result.css).toContain(".alert { animation: warn 1s ease infinite; }");
    expect(nativeDeclarations(result.root, "animation")[0].value).toBe("warn-yummy-android-srgb 1s ease infinite");
  });

  it("retains nested Tailwind states and conditional declaration owners until final CSS lowering", async () => {
    const result = await postcss([legacyWebViewOpacity()]).process(`
      :root { --primary: #007956; }
      .button {
        &:hover {
          @media (hover: hover) {
            @supports (color: color-mix(in lab, red, red)) {
              background: color-mix(in oklab, var(--primary) 20%, transparent);
            }
          }
        }
      }
    `, { from: undefined });
    const lowered = new TextDecoder().decode(compileCss({
      filename: "nested-color-fixture.css",
      code: new TextEncoder().encode(result.css), targets: { chrome: 88 << 16 },
    }).code);
    const native = nativeDeclarations(postcss.parse(lowered), "background");
    expect(native).toHaveLength(1);
    expect(native[0].parent?.toString()).toContain(".button:hover");
    expect(compileLegacyColor(native[0].value, channelVariables(result.root, [":root"]))).toBe("#00795633");
  });

  it("leaves strings and unresolved currentColor expressions intact instead of inventing colors", () => {
    const compiler = createColorCompiler(compileCss);
    const input = 'url("color-mix(in srgb, red, blue)") color-mix(in oklab, currentColor 50%, transparent)';
    expect(compiler.transformValue(input, new Set())).toBe(input);
  });

  it("compiles the actual global CSS pipeline and resolves header-button mixtures in all native theme presets", async () => {
    const filename = fileURLToPath(new URL("../app/globals.css", import.meta.url));
    const result = await postcss([
      tailwindPostcss({ optimize: true }), legacyWebViewOpacity(), legacyWebViewGeometry(), legacyWebViewLayers(),
    ]).process(readFileSync(filename, "utf8"), { from: filename });
    expect(result.warnings()).toEqual([]);
    expect(() => compileCss({
      filename: "native-global-pipeline.css", code: new TextEncoder().encode(result.css), targets: { chrome: 88 << 16 },
    })).not.toThrow();
    const header = nativeDeclarations(result.root, "background-color").find((declaration) =>
      declaration.value.includes("var(--legacy-card-r)") && declaration.value.includes("var(--legacy-primary-text-r)")
    );
    expect(header).toBeDefined();
    const colors = { light: new Set<string | undefined>(), dark: new Set<string | undefined>() };
    for (const theme of ["emerald", "blue", "amber", "rose", "violet", "gold"]) {
      for (const dark of [false, true]) {
        const variables = channelVariables(result.root, [
          ":root", ...(dark ? [".dark"] : []), "html.capacitor-android",
          ...(dark ? ["html.capacitor-android.dark"] : []),
          `html.capacitor-android${dark ? ".dark" : ""}[data-theme-color="${theme}"]`,
        ]);
        const color = compileLegacyColor(header!.value, variables);
        expect(color).toMatch(/^#[\da-f]{3,8}$/i);
        colors[dark ? "dark" : "light"].add(color);
      }
    }
    expect(colors.light.size).toBe(6);
    expect(colors.dark.size).toBe(6);
  }, 30_000);
});
