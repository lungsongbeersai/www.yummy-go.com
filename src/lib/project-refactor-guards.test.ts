import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type TextMatch = {
  file: string;
  token: string;
};

const libDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(libDir, "..");
const projectRoot = join(srcDir, "..");
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const rawImageTagPattern = new RegExp("<" + "img\\b", "g");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(fullPath);
    return entry.isFile() && sourceExtensions.has(extname(entry.name)) ? [fullPath] : [];
  });
}

function normalizedPath(path: string) {
  return relative(srcDir, path).split(sep).join("/");
}

function matchesInFiles(directory: string, pattern: RegExp): TextMatch[] {
  return sourceFiles(directory).flatMap((path) => {
    const content = readFileSync(path, "utf8");
    const matches = [...content.matchAll(pattern)];

    return matches.map((match) => ({
      file: normalizedPath(path),
      token: match[1] ?? match[0]
    }));
  });
}

describe("project refactor guards", () => {
  it("keeps chart.js removed from package manifests", () => {
    const manifest = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8")
    ) as PackageManifest;
    const dependencySections = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies"
    ] as const;
    const sectionsWithChartJs = dependencySections.filter((section) => (
      Boolean(manifest[section]?.["chart.js"])
    ));
    const lockfile = readFileSync(join(projectRoot, "package-lock.json"), "utf8");

    expect(sectionsWithChartJs).toEqual([]);
    expect(lockfile).not.toContain("\"node_modules/chart.js\"");
  });

  it("keeps raw image tags limited to generated print templates", () => {
    const allowedRawImageFiles = new Set([
      "features/pos/print/invoice-print-window.ts",
      "features/pos/table-selection/table-qr-dialog.tsx"
    ]);
    const disallowedRawImages = matchesInFiles(srcDir, rawImageTagPattern)
      .filter((match) => !allowedRawImageFiles.has(match.file));

    expect(disallowedRawImages).toEqual([]);
  });

  it("keeps feature UI free of space utilities and custom pulse loaders", () => {
    const featureMatches = matchesInFiles(
      join(srcDir, "features"),
      /(?:^|[\s"'`])(-?space-[xy]-[^\s"'`]+|animate-pulse)(?=[\s"'`])/g
    );

    expect(featureMatches).toEqual([]);
  });

  it("keeps component UI cleanup exceptions narrow", () => {
    const allowedComponentMatches = new Set([
      "components/ui/avatar.tsx:-space-x-2"
    ]);
    const disallowedComponentMatches = matchesInFiles(
      join(srcDir, "components"),
      /(?:^|[\s"'`])(-?space-[xy]-[^\s"'`]+|animate-pulse)(?=[\s"'`])/g
    ).filter((match) => !allowedComponentMatches.has(`${match.file}:${match.token}`));

    expect(disallowedComponentMatches).toEqual([]);
  });
});
