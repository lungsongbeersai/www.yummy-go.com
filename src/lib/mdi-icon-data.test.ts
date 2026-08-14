import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CATEGORY_MDI_ICONS } from "@/features/settings/category/category-mdi-icons.generated";
import {
  CATEGORY_ICON_OPTIONS,
  DEFAULT_CATEGORY_ICON,
  categoryIconName
} from "@/features/settings/category/category-icons";
import {
  getMdiIconData,
  loadMdiIconData,
  mdiIconName
} from "@/lib/mdi-icon-data";

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(entryPath) : [entryPath];
  });
}

describe("curated MDI icon data", () => {
  it("contains every category picker icon and fallback", () => {
    for (const option of CATEGORY_ICON_OPTIONS) {
      expect(getMdiIconData(categoryIconName(option.value), CATEGORY_MDI_ICONS), option.value).not.toBeNull();
    }
    expect(getMdiIconData(DEFAULT_CATEGORY_ICON, CATEGORY_MDI_ICONS)).not.toBeNull();
  });

  it("loads a saved icon outside the curated set from the bundled catalog", async () => {
    const icon = await loadMdiIconData("mdi:ab-testing", CATEGORY_MDI_ICONS);

    expect(icon?.body).toContain("<path");
    expect(icon?.width).toBe(24);
    expect(icon?.height).toBe(24);
  });

  it("does not load the full catalog for a curated icon", async () => {
    const loadCollection = vi.fn(async () => {
      throw new Error("The full catalog should not be loaded");
    });

    await expect(
      loadMdiIconData(DEFAULT_CATEGORY_ICON, CATEGORY_MDI_ICONS, loadCollection)
    ).resolves.not.toBeNull();
    expect(loadCollection).not.toHaveBeenCalled();
  });

  it("degrades to the caller fallback when the lazy catalog cannot load", async () => {
    const loadCollection = vi.fn(async () => {
      throw new Error("Chunk unavailable");
    });

    await expect(loadMdiIconData("mdi:ab-testing", {}, loadCollection)).resolves.toBeNull();
    expect(loadCollection).toHaveBeenCalledOnce();
  });

  it("resolves collection aliases and rejects missing icons", async () => {
    await expect(loadMdiIconData("mdi:wheat", {})).resolves.not.toBeNull();
    await expect(loadMdiIconData("mdi:not-a-real-saved-icon", {})).resolves.toBeNull();
  });

  it("rejects malformed names and inherited object properties", async () => {
    expect(mdiIconName(" MDI:coffee ")).toBe("coffee");
    expect(mdiIconName("mdi:coffee/onload=alert(1)")).toBeNull();
    expect(mdiIconName("javascript:alert(1)")).toBeNull();
    expect(getMdiIconData("mdi:constructor", {})).toBeNull();
    await expect(loadMdiIconData("mdi:constructor", {})).resolves.toBeNull();
  });

  it("contains only trusted SVG markup in generated icon data", () => {
    const unsafeMarkup = /<(?:embed|foreignObject|iframe|object|script)\b|\bon[a-z]+\s*=|(?:data|javascript):/i;

    for (const [name, icon] of Object.entries(CATEGORY_MDI_ICONS)) {
      expect(icon.body, name).toMatch(/^<path\b/i);
      expect(icon.body, name).not.toMatch(unsafeMarkup);
    }
  });

  it("confines the full MDI collection to lazy-only modules", () => {
    const root = process.cwd();
    const allowedCatalogImporters = ["src/lib/mdi-icon-data.ts"];
    const catalogImporters: string[] = [];

    for (const file of sourceFiles(path.join(root, "src"))) {
      if (!/\.tsx?$/.test(file) || file.endsWith(".test.ts")) continue;
      const relativePath = path.relative(root, file).replaceAll("\\", "/");
      const source = fs.readFileSync(file, "utf8");

      if (source.includes("@iconify-json/mdi")) catalogImporters.push(relativePath);
      expect(source, relativePath).not.toMatch(/from\s+["']@iconify\/react["']/);
      expect(source, relativePath).not.toMatch(/from\s+["']@\/lib\/menu-icon-catalog["']/);
    }

    expect(catalogImporters.sort()).toEqual(allowedCatalogImporters.sort());

    const fallbackSource = fs.readFileSync(path.join(root, "src/lib/mdi-icon-data.ts"), "utf8");
    const pickerSource = fs.readFileSync(
      path.join(root, "src/features/permissions/menu/manage/permission-menu-pickers.tsx"),
      "utf8"
    );
    expect(fallbackSource).toContain('import("@iconify-json/mdi/icons.json")');
    expect(fallbackSource).not.toMatch(/from\s+["']@iconify-json\/mdi/);
    expect(pickerSource).toContain('import("@/lib/menu-icon-catalog")');
  });
});
