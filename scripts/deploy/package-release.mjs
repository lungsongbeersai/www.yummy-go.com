import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export async function packageRelease(projectRoot, archivePath, releaseId) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(releaseId)) {
    throw new Error("Invalid release id");
  }
  const staging = await mkdtemp(join(tmpdir(), "yummygo-release-"));
  // Next can trace .env files into standalone output. They must stay on the VPS.
  const filter = (source) => !/^\.env(?:\.|$)/.test(basename(source));
  try {
    await cp(join(projectRoot, ".next/standalone"), staging, {
      recursive: true,
      filter,
    });
    await cp(join(projectRoot, ".next/static"), join(staging, ".next/static"), {
      recursive: true,
      filter,
    });
    await cp(join(projectRoot, "public"), join(staging, "public"), {
      recursive: true,
      filter,
    });
    await readFile(join(staging, "server.js"));
    const buildId = (await readFile(join(staging, ".next/BUILD_ID"), "utf8")).trim();
    if (!buildId) throw new Error("Missing Next build id");
    const assets = await readdir(join(staging, ".next/static"), { recursive: true });
    const asset = assets.find((name) => /\.(?:js|css)$/.test(name));
    if (!asset) throw new Error("Standalone artifact has no JavaScript/CSS assets");
    await writeFile(join(staging, "public/__yummygo_release.txt"), releaseId);
    await writeFile(join(staging, ".release.json"), JSON.stringify({
      releaseId,
      buildId,
      platform: process.platform,
      arch: process.arch,
      nodeMajor: Number(process.versions.node.split(".")[0]),
      asset: asset.split("\\").join("/"),
      publicEnvironment: Object.fromEntries([
        "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_BASE_URL",
        "NEXT_PUBLIC_SOCKET_URL", "NEXT_PUBLIC_PRINTER_AGENT_URL",
        "NEXT_PUBLIC_PRINTER_AGENT_SECRET", "NEXT_PUBLIC_BASE_PATH", "NEXT_PUBLIC_MOBILE_TCP_DEBUG",
      ].filter((key) => process.env[key]).map((key) => [key,
        createHash("sha256").update(process.env[key]).digest("hex"),
      ])),
    }));
    await mkdir(resolve(archivePath, ".."), { recursive: true });
    execFileSync("tar", ["-czf", resolve(archivePath), "-C", staging, "."]);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [projectRoot, archivePath, releaseId] = process.argv.slice(2);
  if (!projectRoot || !archivePath || !releaseId) {
    throw new Error("Usage: node package-release.mjs PROJECT_ROOT ARCHIVE RELEASE_ID");
  }
  await packageRelease(resolve(projectRoot), resolve(archivePath), releaseId);
}
