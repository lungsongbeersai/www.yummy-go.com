import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss, { type Plugin } from "postcss";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const legacyWebViewOpacity = require(
  "../../scripts/postcss-legacy-webview-opacity.cjs",
) as () => Plugin;

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
});
