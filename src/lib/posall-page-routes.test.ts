import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const srcRoot = resolve(projectRoot, "src");
const retiredPosLiteral = /["'`]\/pos(?:\/|\?|["'`])/;

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(absolutePath);
    if (!entry.isFile() || !/\.(?:css|ts|tsx)$/.test(entry.name)) return [];
    if (/\.(?:spec|test)\.[^.]+$/.test(entry.name)) return [];
    return [absolutePath];
  });
}

describe("POS All browser routes", () => {
  it("has only the POS All app pages and static asset directory", () => {
    for (const currentPath of [
      "src/app/posAll/page.tsx",
      "src/app/(protected)/posAll/order/page.tsx",
      "src/app/(protected)/posAll/tables/page.tsx",
      "public/posAll/background_wide.webp",
    ]) {
      expect(existsSync(resolve(projectRoot, currentPath)), currentPath).toBe(true);
    }

    for (const retiredPath of [
      "src/app/pos/page.tsx",
      "src/app/(protected)/pos/order/page.tsx",
      "src/app/(protected)/pos/tables/page.tsx",
      "public/pos/background_wide.webp",
    ]) {
      expect(existsSync(resolve(projectRoot, retiredPath)), retiredPath).toBe(false);
    }
  });

  it("does not expose a retired /pos browser URL from production source", () => {
    const files = [
      resolve(projectRoot, "next.config.ts"),
      resolve(projectRoot, "scripts/smoke-next-standalone.mjs"),
      ...productionSourceFiles(srcRoot),
    ];

    for (const file of files) {
      expect(
        readFileSync(file, "utf8"),
        relative(projectRoot, file),
      ).not.toMatch(retiredPosLiteral);
    }
  });
});
