import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface ExtraResource {
  from: string;
  filter?: string[];
  to: string;
}

interface ElectronBuilderContract {
  files?: string[];
  extraResources?: ExtraResource[];
}

interface ProjectManifest {
  scripts?: Record<string, string>;
  build?: ElectronBuilderContract;
}

const projectRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

describe("Electron packaging contract", () => {
  it("packages one staged standalone Next runtime", () => {
    const manifest = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8"),
    ) as ProjectManifest;
    const nextConfigSource = readFileSync(
      join(projectRoot, "next.config.ts"),
      "utf8",
    );

    expect(nextConfigSource).toContain('output: "standalone"');
    expect(manifest.scripts?.["electron:stage"]).toBe(
      "node scripts/stage-electron-runtime.mjs",
    );
    expect(manifest.scripts?.["electron:pack:dir"]).toContain(
      "electron-builder --dir",
    );
    expect(manifest.scripts?.["electron:pack"]).not.toContain(
      "electron:start",
    );
    expect(manifest.build?.files).toEqual([
      "!**/*",
      "dist-electron/**/*",
      "package.json",
    ]);
    expect(manifest.build?.extraResources).toEqual([
      {
        from: ".next/electron-runtime",
        to: "next-server",
        filter: ["**/*", "!node_modules{,/**/*}"],
      },
      {
        from: ".next/electron-runtime/node_modules",
        to: "next-server/node_modules",
      },
    ]);
    expect(
      existsSync(join(projectRoot, "scripts/stage-electron-runtime.mjs")),
    ).toBe(true);
    expect(
      existsSync(join(projectRoot, "scripts/smoke-next-standalone.mjs")),
    ).toBe(true);
  });
});
