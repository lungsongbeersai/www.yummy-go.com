import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const overviewDir = dirname(fileURLToPath(import.meta.url));

// Every non-test source file of the dashboard, .ts included: a static import from the page or
// from a pure helper would pull recharts into the eager chunk just the same.
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(fullPath);
    return entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

function normalizedRelativePath(path: string) {
  return relative(overviewDir, path).split(sep).join("/");
}

function source(path: string) {
  return readFileSync(join(overviewDir, path), "utf8");
}

// Direct imports only: a module that re-exported recharts would slip through, so keep chart code
// in the one module below rather than adding a barrel.
describe("dashboard chart bundle boundary", () => {
  it("keeps recharts and the chart primitives inside the chart widgets module", () => {
    const filesWithChartImports = sourceFiles(overviewDir)
      .filter((path) => /from\s+["'](?:recharts|@\/components\/ui\/chart)["']/.test(readFileSync(path, "utf8")))
      .map(normalizedRelativePath);

    expect(filesWithChartImports).toEqual(["components/dashboard-chart-widgets.tsx"]);
  });

  // "Today" is one day with no trend to draw, so the default view must never fetch recharts.
  it("reaches the chart module only through a dynamic import", () => {
    const staticImports = sourceFiles(overviewDir)
      .filter((path) => /from\s+["'][^"']*dashboard-chart-widgets["']/.test(readFileSync(path, "utf8")))
      .map(normalizedRelativePath);

    expect(staticImports).toEqual([]);
    expect(source("components/dashboard-detail-widgets.tsx")).toContain("import(\"./dashboard-chart-widgets\")");
  });

  it("keeps the detail rows out of the page's eager chunk", () => {
    const staticImports = sourceFiles(overviewDir)
      .filter((path) => /from\s+["'][^"']*dashboard-detail-widgets["']/.test(readFileSync(path, "utf8")))
      .map(normalizedRelativePath);

    expect(staticImports).toEqual([]);
    expect(source("dashboard-page.tsx")).toContain("import(\"./components/dashboard-detail-widgets\")");
  });
});
