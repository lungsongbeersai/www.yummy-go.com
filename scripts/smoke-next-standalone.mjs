import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stagedDir = join(projectRoot, ".next", "electron-runtime");
const serverPath = join(stagedDir, "server.js");
const hostname = "127.0.0.1";
const port = 3311;
const baseUrl = `http://${hostname}:${port}`;
const startupDeadline = Date.now() + 30_000;

const checks = [
  { path: "/login", status: 200 },
  { path: "/pos?t=phase-1-smoke", status: 200 },
  { path: "/report/daily-sales", status: 200 },
  {
    path: "/q/phase-1-smoke",
    status: 307,
    location: "/pos?t=phase-1-smoke",
  },
  { path: "/setting/unite", status: 308, location: "/setting/unit" },
];

const child = spawn(process.execPath, [serverPath], {
  cwd: stagedDir,
  env: {
    ...process.env,
    HOSTNAME: hostname,
    PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

let spawnError;
child.once("error", (error) => {
  spawnError = error;
});

async function request(path, timeout = 2_000) {
  return fetch(new URL(path, baseUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(timeout),
  });
}

async function waitForServer() {
  while (Date.now() < startupDeadline) {
    if (spawnError) {
      throw spawnError;
    }

    if (child.exitCode !== null) {
      throw new Error(
        `Standalone server exited before readiness with code ${child.exitCode}`,
      );
    }

    try {
      const remaining = startupDeadline - Date.now();
      if (remaining <= 0) {
        break;
      }
      await request("/login", Math.min(2_000, remaining));
      return;
    } catch {
      const remaining = startupDeadline - Date.now();
      if (remaining > 0) {
        await delay(Math.min(250, remaining));
      }
    }
  }

  throw new Error("Standalone server did not become ready within 30 seconds");
}

try {
  await waitForServer();

  for (const check of checks) {
    const response = await request(check.path);

    if (response.status !== check.status) {
      throw new Error(
        `${check.path}: expected status ${check.status}, received ${response.status}`,
      );
    }

    if (check.location) {
      const locationHeader = response.headers.get("location");
      if (!locationHeader) {
        throw new Error(`${check.path}: missing Location response header`);
      }

      const locationUrl = new URL(locationHeader, baseUrl);
      const normalizedLocation = `${locationUrl.pathname}${locationUrl.search}`;
      if (normalizedLocation !== check.location) {
        throw new Error(
          `${check.path}: expected Location ${check.location}, received ${normalizedLocation}`,
        );
      }
    }

    console.log(`PASS ${check.path} -> ${response.status}`);
  }
} finally {
  child.kill();
}
