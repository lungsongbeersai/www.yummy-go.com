import { createRequire } from "node:module";
import postcss, { type AtRule, type Container, type Plugin } from "postcss";
import selectorParser from "postcss-selector-parser";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const legacyWebViewLayers = require("../../scripts/postcss-legacy-webview-layers.cjs") as () => Plugin;
const legacyWebViewOpacity = require("../../scripts/postcss-legacy-webview-opacity.cjs") as () => Plugin;

type Specificity = [number, number, number];

function compareSpecificity(left: Specificity, right: Specificity) {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function specificity(selector: selectorParser.Selector): Specificity {
  const result: Specificity = [0, 0, 0];
  for (const node of selector.nodes) {
    if (node.type === "id") result[0]++;
    else if (node.type === "class" || node.type === "attribute") result[1]++;
    else if (node.type === "tag") result[2]++;
    else if (node.type === "pseudo" && node.value !== ":where") {
      if ([":not", ":is", ":has"].includes(node.value)) {
        const highest: Specificity = node.nodes.map(specificity).sort(compareSpecificity).at(-1) ?? [0, 0, 0];
        highest.forEach((value, index) => { result[index] += value; });
      } else if (node.value.startsWith("::")) result[2]++;
      else result[1]++;
    }
  }
  return result;
}

// Every selector in the cascade fixtures matches the same hypothetical element.
// Evaluate standard declaration priority rather than checking generated ID counts.
function winningValue(container: Container, property: string) {
  let winner: { value: string; important: boolean; specificity: Specificity } | undefined;
  container.walkRules((rule) => {
    const weight: Specificity = selectorParser().astSync(rule.selector).nodes.map(specificity)
      .sort(compareSpecificity).at(-1) ?? [0, 0, 0];
    rule.walkDecls(property, (declaration) => {
      const candidate = { value: declaration.value, important: Boolean(declaration.important), specificity: weight };
      if (!winner || Number(candidate.important) > Number(winner.important)
        || (candidate.important === winner.important && compareSpecificity(candidate.specificity, winner.specificity) >= 0)) {
        winner = candidate;
      }
    });
  });
  return winner?.value;
}

async function transform(input: string, withOpacity = false) {
  const result = await postcss([
    ...(withOpacity ? [legacyWebViewOpacity()] : []),
    legacyWebViewLayers(),
  ]).process(input, { from: undefined });
  const fallback = result.root.nodes.find((node): node is AtRule =>
    node.type === "atrule" && node.name === "supports" && node.params === "not (color: revert-layer)"
  );
  if (!fallback) throw new Error("Missing legacy WebView cascade fallback");
  return { result, fallback };
}

describe("Android cascade layer compatibility", () => {
  it("preserves the original CSS and limits the layer-free copy to old native engines", async () => {
    const input = "@layer base, utilities; @layer base { ul { list-style: none; } } @layer utilities { .flex { display: flex; } }";
    const { result, fallback } = await transform(input);

    const original = result.root.clone();
    original.last?.remove();
    expect(original.toString()).toBe(postcss.parse(input).toString());
    let layers = 0;
    fallback.walkAtRules("layer", () => { layers++; });
    expect(layers).toBe(0);
    fallback.walkRules((rule) => {
      for (const selector of selectorParser().astSync(rule.selector).nodes) {
        expect(selector.nodes.some((node) =>
          node.type === "pseudo" && node.value === ":where"
          && node.toString() === ":where(.android-webview-compat, .android-webview-compat *)"
        )).toBe(true);
        expect(selector.nodes.some((node) =>
          node.type === "pseudo" && node.value === ":not"
          && node.toString() === ":not(:where(#native-startup-fallback, #native-startup-fallback *))"
        )).toBe(true);
      }
    });
    expect(fallback.toString()).toContain("list-style: none");
    expect(fallback.toString()).toContain("display: flex");
  });

  it("keeps later layers above higher-specificity earlier rules, and unlayered styles above both", async () => {
    const layers = `
      @layer base, utilities;
      @layer utilities { .tone { color: blue; } }
      @layer base { #terminal .tone { color: red; } }
    `;
    expect(winningValue((await transform(layers)).fallback, "color")).toBe("blue");
    expect(winningValue((await transform(`${layers} .tone { color: green; }`)).fallback, "color")).toBe("green");
  });

  it("reverses layer priority for important rules, ahead of important unlayered styles", async () => {
    const { fallback } = await transform(`
      @layer base, utilities;
      @layer base { .tone { color: red !important; padding: 1px; } }
      @layer utilities { #terminal .tone { color: blue !important; padding: 2px; } }
      .tone { color: green !important; padding: 3px; }
    `);

    expect(winningValue(fallback, "color")).toBe("red");
    expect(winningValue(fallback, "padding")).toBe("3px");
  });

  it("scopes root tokens and pseudo-elements without changing animation steps", async () => {
    const { fallback } = await transform(`
      @layer theme { :root { --spacing: 4px; } }
      @layer utilities { .tone::before, .tone:after { content: ""; } }
      html { --spacing: 5px; }
      @keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
    `);
    const rootSelectors: string[] = [];
    const pseudoSelectors: string[] = [];
    let keyframes = "";
    fallback.walkRules((rule) => {
      if (rule.selector.startsWith(":root")) rootSelectors.push(rule.selector);
      if (rule.selector.includes("::before")) pseudoSelectors.push(rule.selector);
    });
    fallback.walkAtRules("keyframes", (rule) => { keyframes = rule.toString(); });

    expect(rootSelectors[0]).toContain(":where(.android-webview-compat, .android-webview-compat *)");
    expect(rootSelectors[0]).not.toContain(".android-webview-compat :root");
    expect(pseudoSelectors[0]).toContain("#native-startup-fallback *))::before");
    expect(pseudoSelectors[0]).toContain("#native-startup-fallback *)):after");
    expect(keyframes).toBe('@keyframes pulse { from { opacity: 0; } to { opacity: 1; } }');
    expect(winningValue(fallback, "--spacing")).toBe("5px");
  });

  it("excludes the standalone startup screen without adding ID specificity", async () => {
    const { fallback } = await transform("@layer base { h1, button { font-size: inherit; height: auto; } }");
    fallback.walkRules((rule) => {
      for (const selector of selectorParser().astSync(rule.selector).nodes) {
        expect(selector.toString()).toContain(
          ":not(:where(#native-startup-fallback, #native-startup-fallback *))",
        );
        expect(specificity(selector)).toEqual([0, 0, 1]);
      }
    });
  });

  it("includes existing Android sRGB and translucent color fallbacks in the cloned cascade", async () => {
    const { fallback } = await transform(`
      @layer theme { :root { --primary: #007956; } }
      @layer utilities {
        .bg-primary\\/45 { background-color: var(--primary); }
        @supports (color: color-mix(in lab, red, red)) {
          .bg-primary\\/45 { background-color: color-mix(in oklab, var(--primary) 45%, transparent); }
        }
      }
    `, true);

    expect(fallback.toString()).toContain("--legacy-primary-rgb: 0, 121, 86");
    let hasAndroidOpacityRule = false;
    fallback.walkRules((rule) => {
      const classes: string[] = [];
      selectorParser().astSync(rule.selector).walkClasses((node) => { classes.push(node.value); });
      if (classes.includes("capacitor-android") && classes.includes("bg-primary/45")) {
        hasAndroidOpacityRule = true;
      }
    });
    expect(hasAndroidOpacityRule).toBe(true);
    expect(fallback.toString()).toContain("rgba(var(--legacy-primary-rgb), calc(var(--legacy-primary-alpha) * 0.45))");
  });

  it("leaves unlayered CSS modules untouched", async () => {
    const input = ".landing { color: green; }";
    const result = await postcss([legacyWebViewLayers()]).process(input, { from: undefined });
    expect(result.css).toBe(input);
  });
});
