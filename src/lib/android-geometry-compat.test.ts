import { createRequire } from "node:module";
import postcss, { type AtRule, type Container, type Declaration, type Plugin, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const geometry = require("../../scripts/postcss-legacy-webview-geometry.cjs") as () => Plugin;
const layers = require("../../scripts/postcss-legacy-webview-layers.cjs") as () => Plugin;
const colors = require("../../scripts/postcss-legacy-webview-opacity.cjs") as () => Plugin;

async function transform(input: string, includeLayers = false) {
  return postcss([geometry(), ...(includeLayers ? [layers()] : [])]).process(input, { from: undefined });
}

function support(container: Container, condition: string) {
  const rule = container.nodes?.find((node): node is AtRule => node.type === "atrule" && node.name === "supports" && node.params === condition);
  if (!rule) throw new Error(`Missing capability fallback: ${condition}`);
  return rule;
}

function selectedRule(container: Container, selector: string) {
  let result: Rule | undefined;
  container.walkRules((rule) => {
    if (rule.selector.startsWith(`${selector}:where(.capacitor-android, .capacitor-android *)`)) result = rule;
  });
  if (!result) throw new Error(`Missing native rule: ${selector}`);
  return result;
}

function declaration(rule: Container, property: string) {
  return rule.nodes?.filter((node): node is Declaration => node.type === "decl" && node.prop === property).at(-1);
}

const transformSupport = "not ((translate: 0) and (rotate: 0deg) and (scale: 1))";

describe("native Android geometry on legacy WebViews", () => {
  it("keeps the original CSS unchanged and scopes each fallback by capability and platform", async () => {
    const input = ".center { translate: -50% -50%; height: 100dvh; overflow: clip; }";
    const result = await transform(input);
    expect(result.root.first?.toString()).toBe(postcss.parse(input).first?.toString());
    for (const condition of [transformSupport, "not (height: 100dvh)", "not (overflow: clip)"]) {
      const fallback = support(result.root, condition);
      fallback.walkRules((rule) => {
        expect(rule.selector).toContain(":where(.capacitor-android, .capacitor-android *)");
      });
    }
    expect(declaration(selectedRule(support(result.root, "not (overflow: clip)"), ".center"), "overflow")?.value).toBe("hidden");
  });

  it("composes translation, rotation and scale before an existing 3D transform", async () => {
    const result = await transform(".control { translate: 12px 25%; rotate: z 90deg; scale: 98% 95%; transform: perspective(500px) rotateY(10deg); }");
    const fallback = support(result.root, transformSupport);
    const rule = selectedRule(fallback, ".control");
    const values = new Map<string, string>();
    rule.walkDecls((item) => { values.set(item.prop, item.value); });
    const composed = values.get("transform")?.replace(/var\((--yg-[^)]+)\)/g, (_, property: string) => values.get(property) ?? "missing");
    expect(composed).toBe("translate(12px, 25%) rotateZ(90deg) scale(0.98, 0.95) perspective(500px) rotateY(10deg)");
    const registrations = new Map<string, AtRule>();
    fallback.walkAtRules("property", (item) => { registrations.set(item.params, item); });
    for (const name of ["--yg-translate", "--yg-rotate", "--yg-scale", "--yg-transform"]) {
      expect(declaration(registrations.get(name)!, "inherits")?.value).toBe("false");
      expect(declaration(registrations.get(name)!, "initial-value")?.value).toBeTruthy();
    }
  });

  it("preserves responsive, checked and active conditions and important priority without forcing dialog positions", async () => {
    const result = await transform(`
      @layer utilities {
        .dialog { top: 1.5rem; left: 50%; translate: -50% 0; }
        @media (min-width: 640px) { .dialog { top: 50% !important; translate: -50% -50% !important; } }
        .thumb { &[data-state=checked] { --tw-translate-x: calc(100% - 2px); translate: var(--tw-translate-x) 0; } }
        .control { &:active { @media (hover: hover) { scale: 98%; } } }
      }
    `);
    const fallback = support(result.root, transformSupport);
    const dialogRules: Rule[] = [];
    fallback.walkRules((rule) => { if (rule.selector.startsWith(".dialog:")) dialogRules.push(rule); });
    expect(dialogRules.map((rule) => declaration(rule, "--yg-translate")?.value)).toEqual(["translate(-50%, 0)", "translate(-50%, -50%)"]);
    expect(declaration(dialogRules[1], "transform")?.important).toBe(true);
    expect(dialogRules[1].parent?.type).toBe("atrule");
    expect((dialogRules[1].parent as AtRule).params).toBe("(min-width: 640px)");
    expect(fallback.toString()).not.toMatch(/(?:top|left):/);
    expect(fallback.toString()).toContain("&[data-state=checked]:where(.capacitor-android, .capacitor-android *)");
    expect(fallback.toString()).toContain("translate(var(--tw-translate-x), 0)");
    expect(fallback.toString()).toContain("&:active:where(.capacitor-android, .capacitor-android *)");
    expect(fallback.toString()).toContain("@media (hover: hover)");
    expect(fallback.toString()).toContain("--yg-scale: scale(0.98)");
  });

  it("supports percentage scale variables and resets without breaking transform transitions", async () => {
    const result = await transform(`
      .pressed { --tw-scale-x: calc(0.98 * 100%); --tw-scale-y: 95%; scale: var(--tw-scale-x) var(--tw-scale-y); transition-property: scale, opacity, rotate; }
      .reset { translate: none; rotate: none; scale: none; transform: none; }
    `);
    const fallback = support(result.root, transformSupport);
    const pressed = selectedRule(fallback, ".pressed");
    expect(declaration(pressed, "--yg-scale-x")?.value).toBe("calc(0.98 * 1)");
    expect(declaration(pressed, "--yg-scale-y")?.value).toBe("0.95");
    expect(declaration(pressed, "transition-property")?.value).toBe("transform, opacity");
    const reset = selectedRule(fallback, ".reset");
    expect(declaration(reset, "--yg-translate")?.value).toBe("translate(0, 0)");
    expect(declaration(reset, "--yg-rotate")?.value).toBe("rotate(0deg)");
    expect(declaration(reset, "--yg-scale")?.value).toBe("scale(1)");
    expect(declaration(reset, "--yg-transform")?.value).toBe("translate(0, 0)");
  });

  it("uses numeric defaults for untouched axes when a control changes only scaleX", async () => {
    const result = await transform(`
      @property --tw-scale-x { syntax: "*"; inherits: false; initial-value: 100%; }
      @property --tw-scale-y { syntax: "*"; inherits: false; initial-value: 100%; }
      .scale-x-95 { --tw-scale-x: 95%; scale: var(--tw-scale-x) var(--tw-scale-y); }
    `);
    const fallback = support(result.root, transformSupport);
    const rule = selectedRule(fallback, ".scale-x-95");
    expect(declaration(rule, "--yg-scale-x")?.value).toBe("0.95");
    expect(declaration(rule, "--yg-scale")?.value).toBe("scale(var(--yg-scale-x), var(--yg-scale-y))");
    const defaults = new Map<string, string>();
    fallback.walkAtRules("property", (item) => { defaults.set(item.params, declaration(item, "initial-value")?.value ?? ""); });
    expect(defaults.get("--yg-scale-y")).toBe("1");
    expect(defaults.get("--yg-scale-z")).toBe("1");
    expect(result.root.first?.toString()).toContain("initial-value: 100%");
  });

  it("bounds arbitrary viewport expressions and variables while retaining full-screen and top-anchored layouts", async () => {
    const result = await transform(`
      .full { top: 0; left: 0; --sheet-height: 100dvh; height: var(--sheet-height); max-height: 100svh; }
      @media (min-width: 640px) { .top { top: 1.5rem; max-height: min(820px, calc(100dvh - 3rem)); } }
      .quoted { content: "100dvh"; --description: '92svh'; width: min(100dvw, 500px); }
    `);
    const fallback = support(result.root, "not (height: 100dvh)");
    const full = selectedRule(fallback, ".full");
    expect(declaration(full, "--sheet-height")?.value).toBe("100vh");
    expect(declaration(full, "max-height")?.value).toBe("100vh");
    expect(declaration(selectedRule(fallback, ".top"), "max-height")?.value).toBe("min(820px, calc(100vh - 3rem))");
    expect(declaration(selectedRule(fallback, ".quoted"), "width")?.value).toBe("min(100vw, 500px)");
    fallback.walkDecls((item) => { expect(["top", "left", "content", "--description"]).not.toContain(item.prop); });
  });

  it("keeps centered geometry throughout named animations without changing browser keyframes", async () => {
    const input = `
      :root { --animate-enter: enter 150ms ease-out; }
      .dialog { translate: -50% -50%; animation: var(--animate-enter); }
      .spinner { animation: spin 1s linear infinite; }
      @keyframes enter { from { opacity: 0; transform: scale(0.95); } }
      @media (prefers-reduced-motion: no-preference) { @keyframes spin { to { transform: rotate(360deg); } } }
    `;
    const result = await transform(input);
    const fallback = support(result.root, transformSupport);
    expect(declaration(selectedRule(fallback, ":root"), "--animate-enter")?.value).toBe("yg-legacy-enter 150ms ease-out");
    expect(declaration(selectedRule(fallback, ".spinner"), "animation")?.value).toBe("yg-legacy-spin 1s linear infinite");
    const frames: AtRule[] = [];
    fallback.walkAtRules("keyframes", (rule) => { frames.push(rule); });
    expect(frames.map((rule) => rule.params)).toEqual(["yg-legacy-enter", "yg-legacy-spin"]);
    expect(frames[1].parent?.type).toBe("atrule");
    expect((frames[1].parent as AtRule).params).toBe("(prefers-reduced-motion: no-preference)");
    let animatedTransform: string | undefined;
    frames[0].walkDecls("transform", (item) => { animatedTransform = item.value; });
    expect(animatedTransform).toBe("var(--yg-translate) var(--yg-rotate) var(--yg-scale) scale(0.95)");
    expect(result.root.nodes.slice(0, 5).map((node) => node.toString()).join("\n")).toBe(postcss.parse(input).nodes.map((node) => node.toString()).join("\n"));
  });

  it("keeps pseudo-element geometry attached to the pseudo-element", async () => {
    const result = await transform(".control::after { translate: -50% 0; }");
    expect(support(result.root, transformSupport).toString()).toContain(".control:where(.capacitor-android, .capacitor-android *)::after");
  });

  it("preserves later valid layout and reduced-motion resets alongside the fallbacks", async () => {
    const result = await transform(`
      .screen { height: 100dvh; max-height: 92dvh; overflow: clip; }
      .automatic { height: auto; max-height: none; overflow-x: visible; }
      .enter { animation: enter 150ms ease-out; transition-property: transform, translate; }
      .duration { animation-duration: 300ms; }
      @media (prefers-reduced-motion: reduce) { .static { animation: none; transition-property: none; } }
      @keyframes enter { from { opacity: 0; transform: scale(0.95); } }
    `);
    const viewport = support(result.root, "not (height: 100dvh)");
    expect(declaration(selectedRule(viewport, ".automatic"), "height")?.value).toBe("auto");
    expect(declaration(selectedRule(viewport, ".automatic"), "max-height")?.value).toBe("none");
    const overflow = support(result.root, "not (overflow: clip)");
    expect(declaration(selectedRule(overflow, ".automatic"), "overflow-x")?.value).toBe("visible");
    const transforms = support(result.root, transformSupport);
    expect(declaration(selectedRule(transforms, ".duration"), "animation-duration")?.value).toBe("300ms");
    expect(declaration(selectedRule(transforms, ".static"), "animation")?.value).toBe("none");
    expect(declaration(selectedRule(transforms, ".static"), "transition-property")?.value).toBe("none");
    expect((selectedRule(transforms, ".static").parent as AtRule).params).toBe("(prefers-reduced-motion: reduce)");
  });

  it("survives the pre-99 cascade fallback with states and viewport constraints intact", async () => {
    const result = await transform("@layer utilities { .thumb[data-state=checked] { translate: 12px 0 !important; } .screen { height: 100dvh; } }", true);
    const legacy = support(result.root, "not (color: revert-layer)");
    expect(legacy.toString()).toContain("translate(12px, 0) !important");
    expect(legacy.toString()).toContain("height: 100vh");
    expect(legacy.toString()).toContain("[data-state=checked]");
    expect(legacy.toString()).not.toContain("@layer");
  });

  it("combines color-safe animation aliases with geometry in the complete native pipeline", async () => {
    const result = await postcss([colors(), geometry(), layers()]).process(`
      @layer theme { :root { --destructive: #dc2626; --animate-alert: alert-pulse 1s infinite; } }
      @layer utilities { .alert { translate: -50% -50%; animation: var(--animate-alert); } }
      @keyframes alert-pulse { from { transform: scale(0.95); box-shadow: 0 0 0 2px color-mix(in oklch, var(--destructive) 30%, transparent); } }
    `, { from: undefined });
    let combined: AtRule | undefined;
    result.root.walkAtRules("keyframes", (rule) => {
      if (rule.params === "yg-legacy-alert-pulse-yummy-android-srgb") combined = rule;
    });
    expect(combined).toBeDefined();
    expect(combined?.toString()).toContain("var(--yg-translate) var(--yg-rotate) var(--yg-scale) scale(0.95)");
    expect(combined?.toString()).toContain("rgba(");
    expect(combined?.toString()).not.toContain("color-mix(");
    const references: string[] = [];
    result.root.walkDecls("--animate-alert", (item) => { references.push(item.value); });
    expect(references).toContain("yg-legacy-alert-pulse-yummy-android-srgb 1s infinite");
  });
});
