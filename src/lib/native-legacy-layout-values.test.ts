import { createRequire } from "node:module";
import postcss, { type Plugin } from "postcss";
import { describe, expect, it } from "vitest";
import { legacyAspectRatio, legacyBodyLayoutStyleSignature, legacyGapMargin, legacyGapPixels, legacyLayoutRoots, legacyLayoutScope, legacyMarginValue, oppositeSide } from "./native-legacy-layout-values";

const require = createRequire(import.meta.url);
const compiler = require("../../scripts/postcss-legacy-webview-layout.cjs") as () => Plugin;

describe("legacy native layout values", () => {
  it("does not rescan the catalog for a modal body pointer lock or its removal", () => {
    const initial = legacyBodyLayoutStyleSignature([["width", "100%", ""]]);
    expect(legacyBodyLayoutStyleSignature([["pointer-events", "none", ""], ["width", "100%", ""]])).toBe(initial);
    expect(legacyBodyLayoutStyleSignature([["width", "100%", ""], ["pointer-events", "auto", "important"]])).toBe(initial);
    expect(legacyBodyLayoutStyleSignature([["width", "100%", ""]])).toBe(initial);
  });
  it("retains scrollbar padding changes even in the same batch as a pointer lock", () => {
    const initial = legacyBodyLayoutStyleSignature([]);
    expect(legacyBodyLayoutStyleSignature([["pointer-events", "none", ""], ["padding-right", "15px", ""]])).not.toBe(initial);
  });
  it("keeps layout declaration removals, priorities and inherited custom values significant", () => {
    expect(legacyBodyLayoutStyleSignature([["width", "100%", ""]])).not.toBe(legacyBodyLayoutStyleSignature([]));
    expect(legacyBodyLayoutStyleSignature([["margin-right", "0px", "important"]])).not.toBe(legacyBodyLayoutStyleSignature([["margin-right", "0px", ""]]));
    expect(legacyBodyLayoutStyleSignature([["--spacing", "4px", ""]])).not.toBe(legacyBodyLayoutStyleSignature([["--spacing", "8px", ""]]));
  });
  it("preserves reset declaration order and values containing CSS punctuation", () => {
    const entries = [["background-image", "url('data:image/svg+xml;a:b')", ""], ["font-size", "16px", "important"]] as const;
    expect(legacyBodyLayoutStyleSignature([["all", "unset", ""], entries[1]])).not.toBe(legacyBodyLayoutStyleSignature([entries[1], ["all", "unset", ""]]));
    expect(legacyBodyLayoutStyleSignature(entries)).not.toBe(legacyBodyLayoutStyleSignature([["background-image", "none", ""], entries[1]]));
  });
  it.each([["1", 1], ["16 / 9", 16 / 9], ["210/297", 210 / 297], ["auto 1/1", 1], ["0/1", null], ["1/0", null], ["auto", null], ["", null]])("reads ratio %s", (value, expected) => {
    expect(legacyAspectRatio(String(value))).toBe(expected);
  });
  it("uses a replaced image's intrinsic ratio for auto ratios", () => {
    expect(legacyAspectRatio("auto 1 / 1", 1.5)).toBe(1.5);
    expect(legacyAspectRatio("1 / 1", 1.5)).toBe(1);
  });
  it("reads gap pixels and percentages without negative or normal gaps", () => {
    expect(legacyGapPixels("8px", 300)).toBe(8);
    expect(legacyGapPixels("10%", 300)).toBe(30);
    expect(legacyGapPixels("normal", 300)).toBe(0);
    expect(legacyGapPixels("-1px", 300)).toBe(0);
    expect(oppositeSide("right")).toBe("left");
  });
  it("recognizes auto margins before selecting a side for gap compensation", () => {
    expect(legacyMarginValue({ margin: "0 auto" }, "left")).toBe("auto");
    expect(legacyMarginValue({ "margin-inline": "auto 8px" }, "left")).toBe("auto");
    expect(legacyMarginValue({ "margin-inline-start": "auto" }, "left")).toBe("auto");
    expect(legacyMarginValue({ margin: "auto", "margin-left": "0px" }, "left")).toBe("0px");
  });
  it("adds gaps to authored CSS lengths without accumulating animated margins", () => {
    expect(legacyGapMargin("0", 8)).toBe("calc(0px + 8px)");
    expect(legacyGapMargin("", 8)).toBe("calc(0px + 8px)");
    expect(legacyGapMargin("1rem", 8)).toBe("calc(1rem + 8px)");
    expect(legacyGapMargin("calc(10% - 2px)", 8)).toBe("calc(calc(10% - 2px) + 8px)");
    expect(legacyGapMargin("auto", 8)).toBeNull();
  });
  it("includes the outside gap owner before restoring a changed control's row", () => {
    const parents: Record<string, string | null> = { checkbox: "label", label: "row", row: "form", form: "page", page: null };
    const owned = new Set(["label", "row"]);
    expect(legacyLayoutScope("label", node => parents[node], node => owned.has(node))).toBe("form");
    expect(legacyLayoutScope("form", node => parents[node], node => owned.has(node))).toBe("form");
    expect(legacyLayoutScope("page", node => parents[node], () => true)).toBe("page");
  });
  it("scans new portal subtrees without promoting them to the unchanged page", () => {
    const parents: Record<string, string | null> = { page: "body", dialog: "body", field: "dialog", button: "field", body: null };
    expect(legacyLayoutRoots(["dialog", "field", "button", "dialog"], node => parents[node])).toEqual(["dialog"]);
    expect(legacyLayoutRoots(["field", "page"], node => parents[node])).toEqual(["field", "page"]);
    expect(legacyLayoutRoots(["body", "field", "dialog"], node => parents[node])).toEqual(["body"]);
  });
  it("keeps margin shorthand resets and important/media cascade in metadata", async () => {
    const result = await postcss([compiler()]).process(`.x{margin-left:auto;margin:0 8px;aspect-ratio:4/3}@media(min-width:600px){.x{margin-inline:12px auto!important;height:auto!important}}`, { from: undefined });
    const margins: string[] = [];
    result.root.walkDecls("--yg-layout-margin-left", declaration => { margins.push(declaration.value); });
    expect(margins.filter(value => value !== "initial")).toEqual(["auto", "8px", "12px"]);
    expect(result.css).toContain("--yg-layout-margin-right:auto!important");
    expect(result.css).toContain("--yg-layout-height:auto!important");
    expect(result.css).toContain("--yg-layout-aspect-ratio:4/3");
    expect(result.css).toContain("@layer base");
  });
  it("retains local CSS-module selectors without introducing global resets", async () => {
    const result = await postcss([compiler()]).process(".card{width:100%;margin-left:auto}", { from: "/src/card.module.css" });
    expect(result.css).not.toContain(":where(*)");
    expect(result.css).not.toContain("@layer");
    expect(result.css).toContain("--yg-layout-width:100%");
    expect(result.css).toContain("--yg-layout-margin-left:auto");
  });
});
