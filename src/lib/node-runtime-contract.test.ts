import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface ProjectManifest {
  engines?: { node?: string };
  scripts?: Record<string, string>;
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const checkerPath = join(projectRoot, "scripts", "check-node-version.mjs");

function check(version: string) {
  return spawnSync(process.execPath, [checkerPath, "--version", version], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

describe("Node runtime contract", () => {
  it("rejects runtimes below the project floor", () => {
    expect(check("21.99.0").status).toBe(1);
  });

  it("accepts Node 22 and later", () => {
    expect(check("22.0.0").status).toBe(0);
    expect(check("24.6.0").status).toBe(0);
  });

  it("keeps package install and CI on the same floor", () => {
    const manifest = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8"),
    ) as ProjectManifest;

    expect(manifest.engines?.node).toBe(">=22.0.0");
    expect(manifest.scripts?.preinstall).toBe(
      "node scripts/check-node-version.mjs",
    );
    expect(manifest.scripts?.["verify:node"]).toBe(
      "node scripts/check-node-version.mjs",
    );
  });
});
