import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The dashboard is the home screen Swan 1 (Android System WebView 101) sits on all day. These
// patterns look fine in a current browser and silently break there, so they are kept out of the
// dashboard's own UI code.
const overviewDir = dirname(fileURLToPath(import.meta.url));

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) return tsxFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [fullPath] : [];
  });
}

function matches(pattern: RegExp) {
  return tsxFiles(overviewDir).flatMap((path) =>
    Array.from(readFileSync(path, "utf8").matchAll(pattern), (match) => `${relative(overviewDir, path).split(sep).join("/")}: ${match[0]}`),
  );
}

describe("dashboard platform guard", () => {
  it("uses no gradient utilities that emit an unguarded `in oklab`", () => {
    // bg-linear-to-* is @supports-guarded by Tailwind; radial/conic are not. Surfaces use the
    // bg-dash-* utilities from globals.css instead.
    expect(matches(/(?<![\w-])bg-(?:radial|conic|gradient-to)(?:-[\w/[\]%.-]+)?/g)).toEqual([]);
  });

  it("moves nothing with translate/scale/rotate utilities, which WebView 101 ignores", () => {
    // Tailwind v4 emits the individual `translate`/`scale`/`rotate` properties (Chromium 104+).
    // Motion uses tw-animate (transform: translate3d) or an inline transform instead.
    // Covers translate-4, -translate-1/2, translate-x-full, scale-95, rotate-180, translate-[10px].
    expect(matches(/(?<![\w-])-?(?:translate|scale|rotate)(?:-[xyz])?-[\w[\]./-]+/g)).toEqual([]);
  });

  it("uses no color-mix(), dvh without a fallback, or container-query sizes", () => {
    expect(matches(/color-mix\(/g)).toEqual([]);
    // Dynamic viewport units (h-dvh, min-h-svh, h-[100dvh]) only behind supports-[height:100dvh]:,
    // next to a vh baseline.
    expect(
      matches(/[^\s"'`]*(?:-|\d)[dsl]vh\b[^\s"'`]*/g).filter((match) => !match.includes("supports-[height:100dvh]:")),
    ).toEqual([]);
    // Chromium 101 has no container queries: every size step must be a viewport breakpoint
    // (@container, @md:, @max-lg:, @[24rem]:, @lg/hero:).
    expect(
      matches(/(?<![\w-])@(?:min-|max-)?(?:\[[^\]]+\]|3xs|2xs|xs|sm|md|lg|xl|[2-7]xl)(?:\/[\w-]+)?:|@container/g),
    ).toEqual([]);
  });

  it("avoids the alpha classes Android compat mode remaps to a different strength", () => {
    expect(
      matches(/(?<![\w-])(?:bg|border|text)-primary-foreground\/(?:10|20|30)(?![\d])/g),
    ).toEqual([]);
  });
});
