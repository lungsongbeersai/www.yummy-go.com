import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePosPrinterContext } from "@/stores/pos-store/printer-context";
import {
  checkPrinterAgentConnection,
  resolvePrinterDeviceIdentity,
} from "./agent-transport";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), apiRequest: vi.fn() }));

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { ...actual, default: { get: mocks.get, post: mocks.post } };
});

vi.mock("@/lib/api", () => ({
  apiRequest: mocks.apiRequest,
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public statusCode = 500) {
      super(message);
    }
  },
}));

vi.mock("@/config/printer-agent", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/config/printer-agent")>(),
  AGENT_URL: "http://127.0.0.1:7777",
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));

vi.mock("@capacitor/device", () => ({
  Device: { getId: vi.fn(), getInfo: vi.fn() },
}));

const agent = {
  agent_id: "front-agent",
  agent_name: "Front POS",
  device_code: "front-pos-device",
  platform: "win32",
};

function browserStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

describe("mobile browser printer Agent probing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockReset();
    browserStorage({ yummy_browser_device_code: "iphone-web-existing" });
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 iPhone Safari" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves the actual POS print context without waiting for an impossible localhost Agent", async () => {
    // A hung probe would never resolve this call. No timer or shorter timeout
    // is used to hide it: the request must not be started on this route.
    mocks.get.mockImplementation(() => new Promise(() => {}));
    await expect(resolvePosPrinterContext({ login_uuid_fk: "cashier-1" })).resolves.toMatchObject({
      agent_id: "mobile",
      device_code: "iphone-web-existing",
    });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it.each([
    "http://127.0.0.1:7777",
    "http://localhost:7777/",
    "https://localhost:7777",
    "http://[::1]:7777",
  ])("keeps the existing browser identity and skips only loopback: %s", async (url) => {
    const storage = browserStorage({ yummy_browser_device_code: "iphone-web-existing" });
    const first = await resolvePrinterDeviceIdentity(url);
    const second = await resolvePrinterDeviceIdentity(url);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, agent: { agent_id: "mobile", device_code: "iphone-web-existing" } });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("preserves cached Agent ownership and its existing disconnected fallback", async () => {
    browserStorage({
      yummy_browser_device_code: "iphone-web-existing",
      yummy_local_printer_agent_identity: JSON.stringify(agent),
    });
    mocks.get.mockRejectedValue(new Error("Agent offline"));
    await expect(resolvePrinterDeviceIdentity()).resolves.toMatchObject({
      ok: true,
      connected: false,
      agent,
      error: "Agent offline",
    });
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:7777/agent/info", expect.objectContaining({ timeout: 5000 }));
  });

  it.each([
    "http://192.168.1.50:7777",
    "https://printer.example.com",
    "http://localhost.example.com:7777",
    "http://printer.local:7777",
    "not-a-url",
    "ftp://localhost:7777",
  ])("retains configured non-loopback or unrecognized Agent routes: %s", async (url) => {
    mocks.get.mockResolvedValue({ data: agent });
    await expect(resolvePrinterDeviceIdentity(url)).resolves.toMatchObject({ ok: true, agent });
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(`${url}/agent/info`, expect.objectContaining({ timeout: 5000 }));
  });

  it.each([
    { userAgent: "Mozilla/5.0 Windows NT 10.0 Chrome", maxTouchPoints: 10 },
    { userAgent: "Mozilla/5.0 Macintosh Safari", maxTouchPoints: 0 },
    { userAgent: "Unknown browser", maxTouchPoints: 10 },
  ])("still probes the Agent for desktop/unknown browsers: %j", async (browser) => {
    vi.stubGlobal("navigator", browser);
    mocks.get.mockResolvedValue({ data: agent });
    await expect(resolvePrinterDeviceIdentity()).resolves.toMatchObject({ ok: true, agent });
    expect(mocks.get).toHaveBeenCalledOnce();
  });

  it("keeps the explicit Agent connection check available on mobile browsers", async () => {
    mocks.get.mockResolvedValue({ data: agent });
    await expect(checkPrinterAgentConnection()).resolves.toMatchObject({ ok: true, agent });
    expect(mocks.get).toHaveBeenCalledOnce();
  });
});
