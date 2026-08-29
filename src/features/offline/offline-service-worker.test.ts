import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const serviceWorker = readFileSync(
  join(testDir, "..", "..", "..", "public", "offline-sw.js"),
  "utf8"
);
const offlineRuntime = readFileSync(
  join(testDir, "offline-app-runtime.tsx"),
  "utf8"
);

describe("offline asset cache", () => {
  it("keeps the complete Next Image query in the cache identity", () => {
    expect(serviceWorker).toContain("assets-v2");
    expect(serviceWorker).toContain(
      "cache.match(request, { ignoreSearch: false })"
    );
    expect(serviceWorker).not.toContain(
      "cache.match(request, { ignoreSearch: true })"
    );
  });

  it("reloads an open customer tab when the corrected worker takes control", () => {
    expect(offlineRuntime).toContain(
      'navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)'
    );
    expect(offlineRuntime).toContain("window.location.reload()");
    expect(offlineRuntime).toContain(
      'navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)'
    );
  });
});
