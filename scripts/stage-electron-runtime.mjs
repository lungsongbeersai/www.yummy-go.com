import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = join(projectRoot, ".next");
const standaloneDir = join(nextDir, "standalone");
const stagedDir = resolve(nextDir, "electron-runtime");

// Keep recursive deletion constrained to the one staging directory under .next.
if (!stagedDir.startsWith(`${resolve(nextDir)}${sep}`)) {
  throw new Error(`Refusing to stage outside ${nextDir}`);
}

await access(join(standaloneDir, "server.js"));
await access(join(nextDir, "BUILD_ID"));
await access(join(nextDir, "static"));
await access(join(projectRoot, "public"));

await rm(stagedDir, { recursive: true, force: true });
await cp(standaloneDir, stagedDir, { recursive: true });
await mkdir(join(stagedDir, ".next"), { recursive: true });
await cp(join(nextDir, "static"), join(stagedDir, ".next", "static"), {
  recursive: true,
});
await cp(join(projectRoot, "public"), join(stagedDir, "public"), {
  recursive: true,
});

await access(join(stagedDir, "server.js"));
await access(join(stagedDir, ".next", "BUILD_ID"));
await access(join(stagedDir, ".next", "static"));
await access(join(stagedDir, "public"));

console.log(stagedDir);
