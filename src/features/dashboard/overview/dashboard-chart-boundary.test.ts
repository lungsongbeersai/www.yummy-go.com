import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const overviewDir = dirname(fileURLToPath(import.meta.url));

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) return tsxFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [fullPath] : [];
  });
}

function normalizedRelativePath(path: string) {
  return relative(overviewDir, path).split(sep).join("/");
}

describe("dashboard chart bundle boundary", () => {
  it("keeps dashboard recharts imports inside the chart widgets module", () => {
    const filesWithRecharts = tsxFiles(overviewDir)
      .filter((path) => readFileSync(path, "utf8").includes("from \"recharts\""))
      .map(normalizedRelativePath);

    expect(filesWithRecharts).toEqual(["components/dashboard-chart-widgets.tsx"]);
  });

  it("keeps lightweight dashboard widgets free from chart primitives", () => {
    const widgets = readFileSync(join(overviewDir, "components", "dashboard-widgets.tsx"), "utf8");

    expect(widgets).not.toContain("from \"recharts\"");
    expect(widgets).not.toContain("@/components/ui/chart");
  });
});
