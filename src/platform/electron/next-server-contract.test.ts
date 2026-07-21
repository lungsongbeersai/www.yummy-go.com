import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertNextServerPortAvailable,
  createNextServerEnvironment,
  createNextServerPaths,
  materializeNextServer,
  waitForNextServer,
  waitForNextServerStartup,
  type NextServerErrorListener,
  type NextServerExitListener,
  type NextServerPaths,
} from "./next-server-contract";

const temporaryRoots: string[] = [];

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "yummy-go-next-server-"));
  temporaryRoots.push(root);
  return root;
}

async function settlementWithin(
  promise: Promise<void>,
  milliseconds: number,
) {
  return new Promise<"pending" | "rejected" | "resolved">((resolve) => {
    const timeout = setTimeout(() => resolve("pending"), milliseconds);

    void promise.then(
      () => {
        clearTimeout(timeout);
        resolve("resolved");
      },
      () => {
        clearTimeout(timeout);
        resolve("rejected");
      },
    );
  });
}

async function listenOnTemporaryPort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ exclusive: true, host: "127.0.0.1", port: 0 }, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Temporary TCP listener did not expose a numeric port");
  }

  return { port: address.port, server };
}

function closeServer(server: ReturnType<typeof createServer>) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function createDeferredReadiness() {
  let resolve: () => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createStartupHarness() {
  const readiness = createDeferredReadiness();
  const errorListeners = new Set<NextServerErrorListener>();
  const exitListeners = new Set<NextServerExitListener>();

  return {
    emitError(type: "FatalError", location: string, report: string) {
      [...errorListeners].forEach((listener) =>
        listener(type, location, report),
      );
    },
    emitExit(code: number) {
      [...exitListeners].forEach((listener) => listener(code));
    },
    errorListeners,
    exitListeners,
    options: {
      subscribeError(listener: NextServerErrorListener) {
        errorListeners.add(listener);
        return () => errorListeners.delete(listener);
      },
      subscribeExit(listener: NextServerExitListener) {
        exitListeners.add(listener);
        return () => exitListeners.delete(listener);
      },
      waitForReadiness: () => readiness.promise,
    },
    readiness,
  };
}

async function writePackagedRuntime(paths: NextServerPaths) {
  await mkdir(join(paths.packagedDirectory, ".next", "static"), {
    recursive: true,
  });
  await mkdir(join(paths.packagedDirectory, "node_modules", "next"), {
    recursive: true,
  });
  await mkdir(join(paths.packagedDirectory, "public"), { recursive: true });
  await writeFile(paths.packagedEntry, "server entry");
  await writeFile(
    join(paths.packagedDirectory, ".next", "BUILD_ID"),
    "build-id",
  );
  await writeFile(
    join(paths.packagedDirectory, ".next", "static", "asset.js"),
    "static asset",
  );
  await writeFile(
    join(paths.packagedDirectory, "public", "logo.txt"),
    "public asset",
  );
  await writeFile(
    join(paths.packagedDirectory, "node_modules", "next", "package.json"),
    "next dependency",
  );
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { force: true, recursive: true }),
    ),
  );
});

describe("packaged Next server contract", () => {
  it("creates packaged and writable paths with a sanitized version", async () => {
    const root = await temporaryRoot();
    const resourcesPath = join(root, "resources");
    const userDataPath = join(root, "user-data");

    const paths = createNextServerPaths({
      appVersion: " 1.2.3 / beta ",
      resourcesPath,
      userDataPath,
    });

    expect(paths).toEqual({
      markerPath: join(userDataPath, "next-runtime", "1.2.3-beta", ".version"),
      packagedDirectory: join(resourcesPath, "next-server"),
      packagedEntry: join(resourcesPath, "next-server", "server.js"),
      runtimeDirectory: join(userDataPath, "next-runtime", "1.2.3-beta"),
      runtimeEntry: join(
        userDataPath,
        "next-runtime",
        "1.2.3-beta",
        "server.js",
      ),
    });
  });

  it("adds production server variables without dropping inherited values", () => {
    const inherited = {
      NODE_ENV: "test",
      PATH: "inherited-path",
      YUMMY_GO_SETTING: "preserved",
    } satisfies NodeJS.ProcessEnv;

    expect(createNextServerEnvironment(4321, inherited)).toMatchObject({
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PATH: "inherited-path",
      PORT: "4321",
      YUMMY_GO_SETTING: "preserved",
    });
  });

  it("refuses an occupied loopback port without closing its listener", async () => {
    const { port, server } = await listenOnTemporaryPort();

    try {
      await expect(assertNextServerPortAvailable(port)).rejects.toThrow(
        `127.0.0.1:${port} is already in use`,
      );
      expect(server.listening).toBe(true);
    } finally {
      await closeServer(server);
    }

    await expect(assertNextServerPortAvailable(port)).resolves.toBeUndefined();
  });

  it("copies the runtime payload and writes its version marker", async () => {
    const root = await temporaryRoot();
    const paths = createNextServerPaths({
      appVersion: "1.2.3",
      resourcesPath: join(root, "resources"),
      userDataPath: join(root, "user-data"),
    });
    await writePackagedRuntime(paths);

    await materializeNextServer(paths, "1.2.3");

    await expect(readFile(paths.runtimeEntry, "utf8")).resolves.toBe(
      "server entry",
    );
    await expect(
      readFile(join(paths.runtimeDirectory, ".next", "static", "asset.js"), "utf8"),
    ).resolves.toBe("static asset");
    await expect(
      readFile(join(paths.runtimeDirectory, "public", "logo.txt"), "utf8"),
    ).resolves.toBe("public asset");
    await expect(
      readFile(
        join(paths.runtimeDirectory, "node_modules", "next", "package.json"),
        "utf8",
      ),
    ).resolves.toBe("next dependency");
    await expect(readFile(paths.markerPath, "utf8")).resolves.toBe("1.2.3");
  });

  it("reuses a complete runtime with a matching marker", async () => {
    const root = await temporaryRoot();
    const paths = createNextServerPaths({
      appVersion: "1.2.3",
      resourcesPath: join(root, "resources"),
      userDataPath: join(root, "user-data"),
    });
    await writePackagedRuntime(paths);
    await materializeNextServer(paths, "1.2.3");
    const runtimeStats = await stat(paths.runtimeDirectory);
    await writeFile(join(paths.runtimeDirectory, "reuse-sentinel"), "keep");

    await materializeNextServer(paths, "1.2.3");

    await expect(
      readFile(join(paths.runtimeDirectory, "reuse-sentinel"), "utf8"),
    ).resolves.toBe("keep");
    expect((await stat(paths.runtimeDirectory)).birthtimeMs).toBe(
      runtimeStats.birthtimeMs,
    );
  });

  it("replaces an incomplete runtime through its sibling staging directory", async () => {
    const root = await temporaryRoot();
    const paths = createNextServerPaths({
      appVersion: "1.2.3",
      resourcesPath: join(root, "resources"),
      userDataPath: join(root, "user-data"),
    });
    const stagingDirectory = `${paths.runtimeDirectory}.staging`;
    await writePackagedRuntime(paths);
    await mkdir(paths.runtimeDirectory, { recursive: true });
    await mkdir(stagingDirectory, { recursive: true });
    await writeFile(paths.runtimeEntry, "incomplete entry");
    await writeFile(join(paths.runtimeDirectory, "stale"), "stale");
    await writeFile(join(stagingDirectory, "abandoned"), "abandoned");

    await materializeNextServer(paths, "1.2.3");

    await expect(readFile(paths.runtimeEntry, "utf8")).resolves.toBe(
      "server entry",
    );
    await expect(access(join(paths.runtimeDirectory, "stale"))).rejects.toThrow();
    await expect(access(stagingDirectory)).rejects.toThrow();
    await expect(readFile(paths.markerPath, "utf8")).resolves.toBe("1.2.3");
  });

  it("replaces a matching runtime when its Next dependency is missing", async () => {
    const root = await temporaryRoot();
    const paths = createNextServerPaths({
      appVersion: "1.2.3",
      resourcesPath: join(root, "resources"),
      userDataPath: join(root, "user-data"),
    });
    const nextDependency = join(
      paths.runtimeDirectory,
      "node_modules",
      "next",
      "package.json",
    );
    await writePackagedRuntime(paths);
    await materializeNextServer(paths, "1.2.3");
    await rm(nextDependency);
    await writeFile(join(paths.runtimeDirectory, "stale"), "stale");

    await materializeNextServer(paths, "1.2.3");

    await expect(readFile(nextDependency, "utf8")).resolves.toBe(
      "next dependency",
    );
    await expect(access(join(paths.runtimeDirectory, "stale"))).rejects.toThrow();
  });

  it("retries failed readiness probes and resolves on the first success", async () => {
    let attempts = 0;
    let currentTime = 0;

    await waitForNextServer("http://127.0.0.1:3000", {
      delay: async (milliseconds) => {
        currentTime += milliseconds;
      },
      intervalMs: 25,
      now: () => currentTime,
      probe: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("not listening");
        return attempts === 3;
      },
      timeoutMs: 100,
    });

    expect(attempts).toBe(3);
    expect(currentTime).toBe(50);
  });

  it("rejects at the timeout without starting another readiness probe", async () => {
    let attempts = 0;
    let currentTime = 0;

    await expect(
      waitForNextServer("http://127.0.0.1:3000", {
        delay: async (milliseconds) => {
          currentTime += milliseconds;
        },
        intervalMs: 25,
        now: () => currentTime,
        probe: async () => {
          attempts += 1;
          return false;
        },
        timeoutMs: 100,
      }),
    ).rejects.toThrow("within 100ms");
    expect(attempts).toBe(4);
    expect(currentTime).toBe(100);
  });

  it("rejects within the timeout when a readiness probe never settles", async () => {
    const outcome = await settlementWithin(
      waitForNextServer("http://127.0.0.1:3000", {
        probe: () => new Promise<boolean>(() => undefined),
        timeoutMs: 25,
      }),
      250,
    );

    expect(outcome).toBe("rejected");
  });

  it("aborts a stalled default fetch when the readiness timeout expires", async () => {
    let observedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          observedSignal = init?.signal ?? undefined;
          observedSignal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    const outcome = await settlementWithin(
      waitForNextServer("http://127.0.0.1:3000", { timeoutMs: 25 }),
      250,
    );

    expect(outcome).toBe("rejected");
    expect(observedSignal?.aborted).toBe(true);
  });

  it("cleans process listeners when startup readiness resolves", async () => {
    const harness = createStartupHarness();
    const startup = waitForNextServerStartup(harness.options);
    expect(harness.exitListeners.size).toBe(1);
    expect(harness.errorListeners.size).toBe(1);

    harness.readiness.resolve();

    await expect(startup).resolves.toBeUndefined();
    expect(harness.exitListeners.size).toBe(0);
    expect(harness.errorListeners.size).toBe(0);
  });

  it("cleans process listeners when startup readiness rejects", async () => {
    const harness = createStartupHarness();
    const startup = waitForNextServerStartup(harness.options);
    const readinessError = new Error("readiness failed");

    harness.readiness.reject(readinessError);

    await expect(startup).rejects.toBe(readinessError);
    expect(harness.exitListeners.size).toBe(0);
    expect(harness.errorListeners.size).toBe(0);
  });

  it("rejects an early process exit and cleans all startup listeners", async () => {
    const harness = createStartupHarness();
    const startup = waitForNextServerStartup(harness.options);

    harness.emitExit(9);

    await expect(startup).rejects.toThrow(
      "Next server exited before readiness with code 9",
    );
    expect(harness.exitListeners.size).toBe(0);
    expect(harness.errorListeners.size).toBe(0);
    harness.readiness.resolve();
  });

  it("rejects a process error and cleans all startup listeners", async () => {
    const harness = createStartupHarness();
    const startup = waitForNextServerStartup(harness.options);

    harness.emitError("FatalError", "v8-worker", "diagnostic report");

    await expect(startup).rejects.toThrow(
      "Next server utility process failed: FatalError at v8-worker",
    );
    expect(harness.exitListeners.size).toBe(0);
    expect(harness.errorListeners.size).toBe(0);
    harness.readiness.resolve();
  });
});
