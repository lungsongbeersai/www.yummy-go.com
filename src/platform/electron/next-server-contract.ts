import {
  access,
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
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
  probe?: (url: string, signal: AbortSignal) => Promise<boolean>;
  now?: () => number;
  delay?: (milliseconds: number) => Promise<void>;
}

export type NextServerExitListener = (code: number) => void;
export type NextServerErrorListener = (
  type: "FatalError",
  location: string,
  report: string,
) => void;

export interface NextServerStartupOptions {
  waitForReadiness: () => Promise<void>;
  subscribeExit: (listener: NextServerExitListener) => () => void;
  subscribeError: (listener: NextServerErrorListener) => () => void;
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

export function assertNextServerPortAvailable(port: number) {
  const hostname = "127.0.0.1";

  return new Promise<void>((resolve, reject) => {
    const server = createServer();
    const handleError = (error: NodeJS.ErrnoException) => {
      server.removeListener("listening", handleListening);
      const message = error.code === "EADDRINUSE"
        ? `${hostname}:${port} is already in use`
        : `Could not verify ${hostname}:${port}: ${error.message}`;
      reject(new Error(message));
    };
    const handleListening = () => {
      server.removeListener("error", handleError);
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen({ exclusive: true, host: hostname, port });
  });
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

async function defaultProbe(url: string, signal: AbortSignal) {
  try {
    const response = await fetch(url, { signal });
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

const probeTimedOut = Symbol("probe-timed-out");

async function probeWithinDeadline(
  url: string,
  probe: (url: string, signal: AbortSignal) => Promise<boolean>,
  remainingMs: number,
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof probeTimedOut>((resolve) => {
    timeout = setTimeout(() => {
      resolve(probeTimedOut);
      controller.abort();
    }, remainingMs);
  });

  try {
    return await Promise.race([probe(url, controller.signal), deadline]);
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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
    const remainingMs = timeoutMs - (now() - startedAt);
    if (remainingMs <= 0) {
      throw new Error(`Next server did not become ready within ${timeoutMs}ms`);
    }

    const probeResult = await probeWithinDeadline(
      url,
      probe,
      remainingMs,
    );
    if (probeResult === true) return;
    if (probeResult === probeTimedOut) {
      throw new Error(`Next server did not become ready within ${timeoutMs}ms`);
    }

    const elapsedMs = now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new Error(`Next server did not become ready within ${timeoutMs}ms`);
    }

    await delay(Math.min(intervalMs, timeoutMs - elapsedMs));
  }
}

export function waitForNextServerStartup(
  options: NextServerStartupOptions,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let unsubscribeExit: (() => void) | undefined;
    let unsubscribeError: (() => void) | undefined;

    const cleanup = () => {
      unsubscribeExit?.();
      unsubscribeExit = undefined;
      unsubscribeError?.();
      unsubscribeError = undefined;
    };
    const settleReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const settleFailed = (reason: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(reason);
    };
    const handleExit: NextServerExitListener = (code) => {
      settleFailed(
        new Error(`Next server exited before readiness with code ${code}`),
      );
    };
    const handleError: NextServerErrorListener = (type, location) => {
      settleFailed(
        new Error(`Next server utility process failed: ${type} at ${location}`),
      );
    };

    try {
      const removeExit = options.subscribeExit(handleExit);
      if (settled) {
        removeExit();
        return;
      }
      unsubscribeExit = removeExit;

      const removeError = options.subscribeError(handleError);
      if (settled) {
        removeError();
        return;
      }
      unsubscribeError = removeError;

      void options.waitForReadiness().then(settleReady, settleFailed);
    } catch (error) {
      settleFailed(error);
    }
  });
}
