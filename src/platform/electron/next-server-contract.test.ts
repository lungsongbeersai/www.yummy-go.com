import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createNextServerEnvironment,
  createNextServerPaths,
  materializeNextServer,
  waitForNextServer,
  type NextServerPaths,
} from "./next-server-contract";

const temporaryRoots: string[] = [];

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "yummy-go-next-server-"));
  temporaryRoots.push(root);
  return root;
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

  it("rejects readiness after the configured timeout", async () => {
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
    expect(attempts).toBe(5);
    expect(currentTime).toBe(100);
  });
});
