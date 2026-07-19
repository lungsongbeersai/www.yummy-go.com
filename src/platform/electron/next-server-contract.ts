import {
  access,
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export interface NextServerPathsInput {
  resourcesPath: string;
  userDataPath: string;
  appVersion: string;
}

export interface NextServerPaths {
  packagedDirectory: string;
  packagedEntry: string;
  runtimeDirectory: string;
  runtimeEntry: string;
  markerPath: string;
}

export interface ServerReadinessOptions {
  timeoutMs?: number;
  intervalMs?: number;
  probe?: (url: string) => Promise<boolean>;
  now?: () => number;
  delay?: (milliseconds: number) => Promise<void>;
}

function sanitizeVersion(appVersion: string) {
  const sanitized = appVersion
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  return sanitized || "unknown";
}

export function createNextServerPaths(
  input: NextServerPathsInput,
): NextServerPaths {
  const packagedDirectory = join(input.resourcesPath, "next-server");
  const runtimeDirectory = join(
    input.userDataPath,
    "next-runtime",
    sanitizeVersion(input.appVersion),
  );

  return {
    packagedDirectory,
    packagedEntry: join(packagedDirectory, "server.js"),
    runtimeDirectory,
    runtimeEntry: join(runtimeDirectory, "server.js"),
    markerPath: join(runtimeDirectory, ".version"),
  };
}

export function createNextServerEnvironment(
  port: number,
  inherited: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...inherited,
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    PORT: String(port),
  };
}

function assertVersionedRuntimePath(
  paths: NextServerPaths,
  appVersion: string,
) {
  const runtimeParent = dirname(paths.runtimeDirectory);
  const expectedVersion = sanitizeVersion(appVersion);
  const hasExpectedLayout =
    basename(runtimeParent) === "next-runtime" &&
    basename(paths.runtimeDirectory) === expectedVersion &&
    paths.runtimeEntry === join(paths.runtimeDirectory, "server.js") &&
    paths.markerPath === join(paths.runtimeDirectory, ".version");

  if (!hasExpectedLayout) {
    throw new Error("Refusing to replace an unsafe Next runtime path");
  }
}

async function runtimeIsComplete(paths: NextServerPaths, appVersion: string) {
  try {
    const marker = await readFile(paths.markerPath, "utf8");
    if (marker !== appVersion) return false;

    await Promise.all([
      access(paths.runtimeEntry),
      access(join(paths.runtimeDirectory, ".next")),
      access(
        join(paths.runtimeDirectory, "node_modules", "next", "package.json"),
      ),
      access(join(paths.runtimeDirectory, "public")),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function materializeNextServer(
  paths: NextServerPaths,
  appVersion: string,
) {
  await access(paths.packagedEntry);
  assertVersionedRuntimePath(paths, appVersion);

  if (await runtimeIsComplete(paths, appVersion)) return;

  const stagingDirectory = `${paths.runtimeDirectory}.staging`;
  await mkdir(dirname(paths.runtimeDirectory), { recursive: true });
  await rm(stagingDirectory, { force: true, recursive: true });
  await cp(paths.packagedDirectory, stagingDirectory, { recursive: true });
  await writeFile(join(stagingDirectory, ".version"), appVersion, "utf8");
  await rm(paths.runtimeDirectory, { force: true, recursive: true });
  await rename(stagingDirectory, paths.runtimeDirectory);
}

async function defaultProbe(url: string) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

function defaultDelay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function waitForNextServer(
  url: string,
  options: ServerReadinessOptions = {},
) {
  const timeoutMs = Math.max(0, options.timeoutMs ?? 30_000);
  const intervalMs = Math.max(1, options.intervalMs ?? 100);
  const probe = options.probe ?? defaultProbe;
  const now = options.now ?? Date.now;
  const delay = options.delay ?? defaultDelay;
  const startedAt = now();

  while (true) {
    try {
      if (await probe(url)) return;
    } catch {
      // A rejected probe is another not-ready result during startup polling.
    }

    const elapsedMs = now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new Error(`Next server did not become ready within ${timeoutMs}ms`);
    }

    await delay(Math.min(intervalMs, timeoutMs - elapsedMs));
  }
}
