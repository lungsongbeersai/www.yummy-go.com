import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(testDir, "..", "..", "..");
const nextConfig = readFileSync(join(projectRoot, "next.config.ts"), "utf8");
const serviceWorker = readFileSync(join(projectRoot, "src", "service-worker", "sw.ts"), "utf8");

describe("offline service worker network policy", () => {
  it("allows the Backend and Local Agent through the worker CSP", () => {
    expect(nextConfig).toContain('"https://api.yummy-go.com"');
    expect(nextConfig).toContain('"http://127.0.0.1:7777"');
    expect(nextConfig).toContain('"http://localhost:7777"');
    expect(nextConfig).toContain('"https://plc-files.sgp1.vultrobjects.com"');
    expect(nextConfig).toContain('"https://placehold.co"');
    expect(nextConfig).toContain('"https://flagcdn.com"');
    expect(nextConfig).toContain("`connect-src ${serviceWorkerConnectSources.join(\" \")}`");
  });

  it("keeps Local Agent requests out of runtime caches", () => {
    expect(serviceWorker).toContain("process.env.NEXT_PUBLIC_PRINTER_AGENT_URL");
    expect(serviceWorker).toContain("url.origin === LOCAL_AGENT_ORIGIN");
    expect(serviceWorker).toContain("handler: new NetworkOnly()");
  });
});
