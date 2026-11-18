import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import tailwindPostcss from "@tailwindcss/postcss";
import { is } from "css-select";
import { Element } from "domhandler";
import { transform as compileCss } from "lightningcss";
import postcss, { type AtRule, type Plugin } from "postcss";
import selectorParser from "postcss-selector-parser";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const plugin = (name: string) => (require(`../../scripts/postcss-legacy-webview-${name}.cjs`) as () => Plugin)();
const { UNLAYERED_TIER } = require("../../scripts/postcss-legacy-webview-83.cjs") as { UNLAYERED_TIER: number };
type SelectorCompiler = {
  lowerSelectorList: (selector: string) => string;
  specificity: (selector: selectorParser.Selector) => number[];
  SPECIFICITY_OFFSET: number[];
};
const { createSelectorCompiler } = require("../../scripts/legacy-selectors.cjs") as {
  createSelectorCompiler: (parser: typeof selectorParser) => SelectorCompiler;
};
const { lowerSelectorList, specificity, SPECIFICITY_OFFSET } = createSelectorCompiler(selectorParser);

function element(name: string, attributes: Record<string, string> = {}, children: Element[] = []) {
  const node = new Element(name, attributes, children);
  children.forEach((child, index) => {
    child.parent = node;
    child.prev = children[index - 1] ?? null;
    child.next = children[index + 1] ?? null;
  });
  return node;
}

function allElements(node: Element): Element[] {
  return [node, ...node.children.filter((child): child is Element => child.type === "tag").flatMap(allElements)];
}

function equivalent(selector: string, root: Element) {
  const lowered = lowerSelectorList(selector);
  const all = allElements(root);
  expect(all.filter((node) => is(node, lowered))).toEqual(all.filter((node) => is(node, selector)));
  return lowered;
}

function assertCss3Selectors(fallback: AtRule) {
  const invalid: string[] = [];
  fallback.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
    selectorParser().astSync(rule.selector).walkPseudos((node) => {
      if ([":is", ":where", ":dir", ":has", ":focus-visible", "::file-selector-button"].includes(node.value)
        || (node.value === ":not" && (node.nodes.length !== 1 || node.first.nodes.length !== 1
          || node.first.first.value === ":-webkit-any"))) invalid.push(node.toString());
    });
  });
  expect(invalid).toEqual([]);
}

function winningProperty(fallback: AtRule, target: Element, property: string) {
  const candidates: { value: string; weight: number[]; important: boolean }[] = [];
  fallback.walkDecls(property, (declaration) => {
    if (declaration.parent?.type !== "rule") return;
    for (const selector of selectorParser().astSync(declaration.parent.selector).nodes) {
      if (selector.nodes.some((node) => node.type === "pseudo" && (node.value.startsWith("::") || [":before", ":after"].includes(node.value)))) continue;
      let inactive = false;
      selector.walkPseudos((node) => {
        if ([":hover", ":focus", ":focus-within", ":active", ":lang", ":host"].includes(node.value)) inactive = true;
      });
      if (!inactive && is(target, selector.toString().replace(/:-webkit-any\(/g, ":is("))) {
        candidates.push({ value: declaration.value, weight: specificity(selector), important: Boolean(declaration.important) });
      }
    }
  });
  candidates.sort((a, b) => Number(a.important) - Number(b.important) || a.weight[0] - b.weight[0] || a.weight[1] - b.weight[1] || a.weight[2] - b.weight[2]);
  return candidates.at(-1)?.value;
}

async function compile(input: string, allPlugins = true) {
  const result = await postcss([
    ...(allPlugins ? [plugin("layout"), plugin("opacity"), plugin("geometry"), plugin("layers")] : []),
    plugin("83"),
  ]).process(input, { from: undefined });
  const fallback = result.root.last;
  if (fallback?.type !== "atrule" || fallback.params !== "not selector(:where(*))") throw new Error("Missing83 fallback");
  return { result, fallback };
}

describe("native Chromium83 selector compatibility", () => {
  it("preserves same, nested and interleaved ancestor constraints", () => {
    const roots = [
      element("html", { class: "capacitor-android dark" }, [element("button", { class: "target" })]),
      element("html", { class: "dark" }, [element("body", { class: "capacitor-android" }, [element("button", { class: "target" })])]),
      element("html", { class: "capacitor-android" }, [element("body", { class: "dark" }, [element("button", { class: "target" })])]),
      element("html", { class: "capacitor-android" }, [element("body", {}, [element("button", { class: "target" })])]),
    ];
    for (const root of roots) equivalent(".capacitor-android .target:is(.dark *,[data-yg-theme=dark] *)", root);
  });

  it("intersects child, descendant and sibling variants without weakening them", () => {
    const targets = [element("button", { class: "target" }), element("div", { class: "wrapper" }, [element("button", { class: "target" })])];
    const root = element("html", { class: "capacitor-android dark" }, [
      element("section", { class: "group" }, [element("input", { class: "peer selected" }), element("input", { class: "peer checked" }), ...targets]),
    ]);
    for (const selector of [
      ".target:is(.group>*):is(.dark *)",
      ".target:is(.group *):is(.peer~*)",
      ".target:is(.peer.selected~*):is(.peer.checked~*)",
      ".target:is(.peer.selected+*):is(.peer.checked~*)",
      ".target:is(.group>*):is(.group *)",
      ".group .target:is(.group>*)",
      ".group>.target:is(.dark *)",
    ]) equivalent(selector, root);
  });

  it("preserves :where zero specificity and :is maximum specificity on every expansion", () => {
    for (const selector of [
      ".target:where(.capacitor-android,.capacitor-android *)",
      ".target:is(#strong,.weak)",
      "ul:where(.group>*)::before",
      ".target:is(:where(.group)[data-state=open] *)",
      ".target:not(.one,.two)",
      ".target:not(.one.two)",
    ]) {
      const expected = specificity(selectorParser().astSync(selector).first)
        .map((value, index) => value + SPECIFICITY_OFFSET[index]);
      for (const branch of selectorParser().astSync(lowerSelectorList(selector)).nodes) expect(specificity(branch)).toEqual(expected);
    }
  });

  it("uses CSS3 marker negation for startup content and nested public light themes", () => {
    const target = element("button", { class: "target" });
    const light = element("main", { "data-yg-theme": "light" }, [element("button", { class: "target", "data-yg-legacy-light-ancestor": "" })]);
    const fallback = element("div", { id: "native-startup-fallback", "data-native-startup-content": "" }, [
      element("h1", { class: "target", "data-native-startup-content": "" }),
    ]);
    const root = element("html", { class: "capacitor-android dark" }, [target, light, fallback]);
    const lowered = lowerSelectorList(".target:is(.dark *):not(:where([data-yg-theme=light] *)):not(:where(#native-startup-fallback,#native-startup-fallback *))");
    expect(allElements(root).filter((node) => is(node, lowered))).toEqual([target]);
    expect(lowered).not.toContain(":where");
  });

  it("rejects an unknown complex negation instead of generating a broader match", () => {
    expect(() => lowerSelectorList(".target:not(.unknown *)")).toThrow("explicit legacy DOM marker");
  });


  it("omits unsupported relational branches while preserving their explicit native alternatives", async () => {
    const { fallback } = await compile(".a:has(input),.explicit{color:red}", false);
    expect(fallback.toString()).not.toContain(":has");
    expect(fallback.toString()).toContain(".explicit");
  });

  it("keeps mandatory83 styles active when optional rendering compatibility is disabled", async () => {
    const { fallback } = await compile("@layer base,utilities;@layer utilities{.button{display:flex}}.android-webview-compat .effect{filter:none}");
    const target = element("button", { class: "button effect" });
    element("html", { class: "capacitor-android" }, [target]);
    expect(winningProperty(fallback, target, "display")).toBe("flex");
    expect(winningProperty(fallback, target, "filter")).toBeUndefined();
  });

  it("leaves modern CSS unchanged and retains native root and descendant scoping", async () => {
    const input = ".button:where([data-active]){margin-inline:2px;inset:0;color:red}";
    const { result, fallback } = await compile(input, false);
    const original = result.root.clone(); original.last?.remove();
    expect(original.toString()).toBe(postcss.parse(input).toString());
    assertCss3Selectors(fallback);
    expect(fallback.toString()).toContain("margin-inline-start");
    expect(fallback.toString()).toContain("margin-inline-end");
    expect(fallback.toString()).toContain("top: 0");
    expect(fallback.toString()).not.toContain("--yummy-go-legacy83-ready");
    const selector = fallback.nodes?.find((node) => node.type === "rule") as postcss.Rule;
    const native = element("html", { class: "capacitor-android button", "data-active": "" }, [element("button", { class: "button", "data-active": "" })]);
    expect(allElements(native).every((node) => is(node, selector.selector))).toBe(true);
    const web = element("html", {}, [element("button", { class: "button", "data-active": "" })]);
    expect(allElements(web).some((node) => is(node, selector.selector))).toBe(false);
  });

  it("keeps native host classes global and authored classes local through Next's pure CSS Modules", async () => {
    const localByDefault = require("next/dist/compiled/postcss-modules-local-by-default") as (options: { mode: string }) => Plugin;
    const scope = require("next/dist/compiled/postcss-modules-scope") as (options: { generateScopedName: (name: string) => string }) => Plugin;
    const result = await postcss([plugin("layout"), plugin("opacity"), plugin("geometry"), plugin("layers"), plugin("83")])
      .process(".card{margin-left:4px;width:10px;padding:12px;translate:50% 0;opacity:.5}", { from: "fixture.module.css" });
    expect(result.css).toContain(":global(.capacitor-android)");
    const scoped = await postcss([localByDefault({ mode: "pure" }), scope({ generateScopedName: name => `module_${name}` })])
      .process(result.css, { from: "fixture.module.css" });
    expect(scoped.css).toContain(".module_card");
    expect(scoped.css).toContain(".capacitor-android");
    expect(scoped.css).not.toContain("module_capacitor-android");
    expect(scoped.css).not.toContain("module_android-webview-compat");
    expect(scoped.css).not.toContain("--yummy-go-legacy83-ready");
  });

  it("expands variable logical spacing to83-supported longhands before the final optimizer", async () => {
    const input = `
      .px-4 { padding-inline:calc(var(--spacing) * 4) !important }
      .py-2 { padding-block:calc(var(--spacing) * 2) }
      .axis { margin-inline:calc(var(--spacing) * -2) auto;scroll-padding-inline:var(--start) var(--end);scroll-margin-block:var(--start) var(--end) }
      @media (min-width:600px) { .button:hover { padding-inline:var(--card-spacing);padding-left:3px } }
    `;
    const { result, fallback } = await compile(input, false);
    const original = result.root.clone(); original.last?.remove();
    expect(original.toString()).toBe(postcss.parse(input).toString());
    for (const container of [fallback, postcss.parse(compileCss({ filename: "spacing83.css", code: Buffer.from(fallback.toString()), targets: { chrome: 83 << 16 }, minify: true }).code.toString()).first as AtRule]) {
      const declarations: postcss.Declaration[] = [];
      container.walkDecls((declaration) => { declarations.push(declaration); });
      expect(declarations.some((decl) => /^(padding|margin|scroll-padding|scroll-margin)-(inline|block)$/.test(decl.prop))).toBe(false);
      for (const side of ["start", "end"]) {
        const padding = declarations.find((decl) => decl.prop === `padding-inline-${side}` && decl.value.includes("--spacing"));
        expect(padding?.value.replace(/\s/g, "")).toBe("calc(var(--spacing)*4)");
        expect(padding?.important).toBe(true);
        expect(declarations.find((decl) => decl.prop === `padding-block-${side}`)?.value.replace(/\s/g, "")).toBe("calc(var(--spacing)*2)");
      }
      expect(declarations.find((decl) => decl.prop === "margin-inline-end")?.value).toBe("auto");
      expect(declarations.find((decl) => decl.prop === "scroll-padding-inline-end")?.value).toBe("var(--end)");
      expect(declarations.find((decl) => decl.prop === "scroll-margin-block-end")?.value).toBe("var(--end)");
      expect(container.toString()).toMatch(/@media\s*\(min-width:\s*600px\)/);
      expect(container.toString()).toContain(":hover");
    }
  });

  it("lowers variable inset axes and logical borders/radii without losing values or important", async () => {
    const { fallback } = await compile(`
      .all { inset:var(--top) calc(var(--space) * 2) var(--bottom) var(--left) !important }
      .axis { inset-inline:var(--start) var(--end);inset-block:var(--top) var(--bottom);border-inline:var(--width) solid var(--color);border-block-style:var(--style);border-inline-width:var(--start) var(--end);border-start-start-radius:var(--radius) }
    `, false);
    const declarations: postcss.Declaration[] = [];
    fallback.walkDecls((declaration) => { declarations.push(declaration); });
    expect(declarations.some((decl) => /^inset(?:-|$)/.test(decl.prop))).toBe(false);
    expect(declarations.some((decl) => /^border-(?:inline|block)(?:-(?:width|style|color))?$/.test(decl.prop))).toBe(false);
    for (const [prop, value] of [["top", "var(--top)"], ["bottom", "var(--bottom)"], ["left", "var(--left)"]]) {
      expect(declarations.some((decl) => decl.prop === prop && decl.value === value && decl.important)).toBe(true);
    }
    expect(declarations.some((decl) => decl.prop === "left" && decl.value === "var(--start)")).toBe(true);
    expect(declarations.some((decl) => decl.prop === "right" && decl.value === "var(--start)")).toBe(true);
    expect(declarations.find((decl) => decl.prop === "border-inline-start")?.value).toBe("var(--width) solid var(--color)");
    expect(declarations.find((decl) => decl.prop === "border-inline-end-width")?.value).toBe("var(--end)");
    expect(declarations.some((decl) => decl.prop === "border-top-left-radius" && decl.value === "var(--radius)")).toBe(true);
    expect(declarations.some((decl) => decl.prop === "border-top-right-radius" && decl.value === "var(--radius)")).toBe(true);
    assertCss3Selectors(fallback);
  });

  it("keeps compiler-added direction conditions from defeating a later physical reset", async () => {
    const { fallback } = await compile(`
      .start { inset-inline-start:var(--offset) !important;border-start-start-radius:var(--radius) }
      .reset { left:0 !important;border-top-left-radius:0 }
    `, false);
    const weights = new Map<string, number[][]>();
    const order: string[] = [];
    fallback.walkRules((rule) => {
      const key = rule.selector.includes(".start:") ? "start" : rule.selector.includes(".reset:") ? "reset" : null;
      if (!key) return;
      order.push(key);
      for (const entry of selectorParser().astSync(rule.selector).nodes) {
        const important = rule.nodes.some((node) => node.type === "decl" && node.important);
        expect(specificity(entry)).toEqual([important ? 0 : UNLAYERED_TIER, 9, 2]);
        weights.set(key, [...(weights.get(key) ?? []), specificity(entry)]);
      }
    });
    expect(weights.has("start")).toBe(true);
    expect(weights.has("reset")).toBe(true);
    expect(order.lastIndexOf("start")).toBeLessThan(order.indexOf("reset"));
    let remainingLayers = 0; fallback.walkAtRules("layer", () => { remainingLayers++; });
    expect(remainingLayers).toBe(0);
  });

  it("records complete nested-selector weights before native logical conversion", async () => {
    const { fallback } = await compile(".outer{.inner{padding-inline:var(--space);&:hover{inset-inline-start:var(--offset)}}}", false);
    assertCss3Selectors(fallback);
    fallback.walkRules((rule) => {
      for (const entry of selectorParser().astSync(rule.selector).nodes) {
        expect(specificity(entry)).toEqual([UNLAYERED_TIER, rule.selector.includes(":hover") ? 11 : 10, 2]);
      }
    });
  });

  it("preserves global-layer and separate CSS-module priority, including reversed important layers", async () => {
    const { fallback: global } = await compile(`
      @layer base,utilities;
      @layer base { #terminal [data-card] { padding:0;width:auto;margin:1px!important } }
      @layer utilities { [data-card] { padding:8px;width:200px;border-width:2px!important;margin:2px!important } }
      #terminal [data-card] { outline-color:red }
      [data-card] { border-width:3px!important }
    `);
    const localByDefault = require("next/dist/compiled/postcss-modules-local-by-default") as (options: { mode: string }) => Plugin;
    const scope = require("next/dist/compiled/postcss-modules-scope") as (options: { generateScopedName: (name: string) => string }) => Plugin;
    const compiledModule = await postcss([plugin("layout"), plugin("opacity"), plugin("geometry"), plugin("layers"), plugin("83")])
      .process(".card{padding:24px;width:100px;outline-color:blue;border-width:4px!important;margin:4px!important}", { from: "card.module.css" });
    const scoped = await postcss([localByDefault({ mode: "pure" }), scope({ generateScopedName: name => `module_${name}` })])
      .process(compiledModule.css, { from: "card.module.css" });
    const moduleFallback = scoped.root.nodes.find((node): node is AtRule => node.type === "atrule" && node.name === "supports" && node.params === "not selector(:where(*))");
    expect(moduleFallback).toBeDefined();
    const target = element("div", { class: "module_card", "data-card": "" });
    element("html", { class: "capacitor-android", id: "terminal" }, [target]);
    for (const order of [[global, moduleFallback!], [moduleFallback!, global]]) {
      const combined = postcss.atRule({ name: "supports", params: "not selector(:where(*))", nodes: order.flatMap((sheet) => (sheet.nodes ?? []).map((node) => node.clone())) });
      expect(winningProperty(combined, target, "padding")).toBe("24px");
      expect(winningProperty(combined, target, "width")).toBe("100px");
      expect(winningProperty(combined, target, "outline-color")).toBe("red");
      expect(winningProperty(combined, target, "border-width")).toBe("2px");
      expect(winningProperty(combined, target, "margin")).toBe("1px");
    }
  });

  it("preserves flattened layer priority, native animation aliases and noninherited property defaults", async () => {
    const { fallback } = await compile(`
      @layer base, utilities;
      :root { --yummy-go-styles-ready:1 }
      @property --tw-translate-x { syntax:"*";inherits:false;initial-value:0 }
      @layer base { #terminal .button { color:red } }
      @layer utilities {
        .button { color:blue;inset:0;border-start-start-radius:4px;animation:pulse 1s;translate:50% 0 }
        @keyframes pulse { from { color:oklch(50% .1 120);translate:0 0 } to { color:oklch(60% .1 120);translate:10px 0 } }
      }
    `);
    assertCss3Selectors(fallback);
    const declarations: postcss.Declaration[] = [];
    fallback.walkDecls("--tw-translate-x", (declaration) => { declarations.push(declaration); });
    expect(declarations.some((declaration) => declaration.value === "0")).toBe(true);
    expect(fallback.toString()).toContain("yg-legacy-pulse-yummy-android-srgb");
    let layers = 0; fallback.walkAtRules("layer", () => { layers++; });
    expect(layers).toBe(0);
    expect(fallback.toString()).toMatch(/--yummy-go-legacy83-ready:\s*1/);
    expect(() => compileCss({ filename: "fixture83.css", code: Buffer.from(fallback.toString()), targets: { chrome: 83 << 16 } })).not.toThrow();
    const root = element("html", { class: "capacitor-android android-webview-compat" }, [element("div", { id: "terminal" }, [element("button", { class: "button" })])]);
    const target = allElements(root).at(-1)!;
    const candidates: { value: string; weight: number[]; important: boolean }[] = [];
    fallback.walkDecls("color", (decl) => {
      if (decl.parent?.type !== "rule") return;
      for (const selector of selectorParser().astSync(decl.parent.selector).nodes) {
        if (is(target, selector.toString())) candidates.push({ value: decl.value, weight: specificity(selector), important: Boolean(decl.important) });
      }
    });
    candidates.sort((a, b) => Number(a.important) - Number(b.important) || a.weight[0] - b.weight[0] || a.weight[1] - b.weight[1] || a.weight[2] - b.weight[2]);
    expect(candidates.at(-1)?.value).toBe("#00f");
  });

  it("compiles actual global source with metadata, color, geometry, layers and83 selectors", async () => {
    const filename = fileURLToPath(new URL("../app/globals.css", import.meta.url));
    const result = await postcss([
      tailwindPostcss({ optimize: true }), plugin("layout"), plugin("opacity"), plugin("geometry"), plugin("layers"), plugin("83"),
    ]).process(readFileSync(filename, "utf8"), { from: filename });
    expect(result.warnings()).toEqual([]);
    const fallback = result.root.last as AtRule;
    assertCss3Selectors(fallback);
    expect(fallback.toString()).toContain("--yg-layout-margin-left");
    expect(fallback.toString()).toContain("--yg-scale-x");
    expect(fallback.toString()).toContain("--legacy-primary-r");
    const optimized = compileCss({ filename: "global83.css", code: Buffer.from(result.css), targets: { chrome: 83 << 16 }, minify: true });
    const optimizedFallback = postcss.parse(optimized.code.toString()).last as AtRule;
    assertCss3Selectors(optimizedFallback);
    for (const container of [fallback, optimizedFallback]) {
      const unsupported: string[] = [];
      container.walkDecls((declaration) => {
        if (/^(?:(?:margin|padding|scroll-margin|scroll-padding|inset)-(?:inline|block)|inset(?:-(?:inline|block)-(?:start|end))?|border-(?:inline|block)(?:-(?:width|style|color))?|border-(?:start|end)-(?:start|end)-radius)$/.test(declaration.prop)) unsupported.push(declaration.prop);
      });
      expect(unsupported).toEqual([]);
    }
    // Runtime-injected library styles must participate in the transformed
    // cascade too; otherwise the uniformly padded preflight beats their resets.
    const toast = element("li", { "data-sonner-toast": "", "data-styled": "true" });
    const handle = element("div", { "data-vaul-handle": "", class: "w-10" });
    element("html", { class: "capacitor-android android-webview-compat" }, [toast, handle]);
    expect(winningProperty(fallback, toast, "padding")).toBe("16px");
    expect(winningProperty(fallback, handle, "width")).toBe("32px");
    // An opt-in artifact lets the real Chromium83 QA reuse this exact compiler
    // snapshot without making the pure unit suite depend on an installed browser.
    if (process.env.YUMMY_GO_83_CSS_FIXTURE) writeFileSync(process.env.YUMMY_GO_83_CSS_FIXTURE, result.css);
  }, 120_000);
});
