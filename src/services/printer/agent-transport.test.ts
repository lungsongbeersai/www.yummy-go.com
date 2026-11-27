import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { resolvePosPrinterContext } from "@/stores/pos-store/printer-context";
import {
  checkPrinterAgentConnection,
  dispatchPrintJob,
  getLocalAgentInfo,
  printBatchWithLocalAgent,
  printWithLocalAgent,
  resolvePrinterDeviceIdentity,
} from "./agent-transport";
import { getPrinterDeliveryState } from "./helpers";
import { resetSessionStores } from "@/stores/session-store-registry";
import type { PrintJob } from "./types";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), apiRequest: vi.fn(),
  native: false,
  printMobileEscposOverTcp: vi.fn(),
  printSunmiEscpos: vi.fn(),
}));

const agent = {
  agent_id: "front-agent",
  agent_name: "Front POS",
  device_code: "front-pos-device",
  platform: "win32",
};

function deferredValue<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("Agent batch progress observer cleanup", () => {
  const jobsFor = (shared = false): PrintJob[] => Array.from({ length: 3 }, (_, index) => ({
    job_id: `receipt-${index + 1}`, print_config_uuid: "receipt-printer",
    agent_id: shared ? "owner-agent" : agent.agent_id,
    device_code: shared ? "owner-device" : agent.device_code,
    interface_value: "tcp://192.0.2.10:9100", printer_type: "epson",
    lang: "eng", paper_width_mm: 80, ops: [],
  }));
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.native = false;
  });
  afterEach(() => { vi.useRealTimers(); });

  it.each([false, true])("returns an authoritative %s batch success without waiting for an abort-ignoring progress GET", async (shared) => {
    const progress = deferredValue<{ data: { ok: boolean; completed: number; status: string } }>();
    const post = deferredValue<{ data: { ok: boolean } }>();
    mocks.get.mockReturnValueOnce(progress.promise);
    mocks.post.mockReturnValueOnce(post.promise);
    const jobs = jobsFor(shared);
    const onProgress = vi.fn();
    const settled = vi.fn();
    const printing = printBatchWithLocalAgent(jobs, agent, "per_ticket", onProgress).then(settled);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).not.toHaveBeenCalled();
    post.resolve({ data: { ok: true } });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toHaveBeenCalledOnce();
    await printing;
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(3, 3);
    const signal: AbortSignal = mocks.get.mock.calls[0][1].signal;
    expect(signal.aborted).toBe(true);
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      `http://127.0.0.1:7777/print-ops-batch${shared ? "-relay" : ""}`,
      { jobs, cut_mode: "per_ticket", progress_id: expect.any(String) },
      expect.objectContaining({ timeout: 75000 }),
    );
    expect(mocks.post.mock.calls[0][2].signal).toBeUndefined();
    progress.resolve({ data: { ok: true, completed: 1, status: "printing" } });
    await vi.advanceTimersByTimeAsync(4000);
    expect(onProgress).toHaveBeenCalledOnce();
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { observed: 1, response: 2 }, { observed: 2, response: 1 },
  ])("returns POST failure promptly with its known prefix when progress observed $observed and POST reported $response", async ({ observed, response }) => {
    const progress = deferredValue<{ data: { ok: boolean; completed: number; status: string } }>();
    const post = deferredValue<{ data: { ok: boolean } }>();
    mocks.get.mockResolvedValueOnce({ data: { ok: true, completed: observed, status: "printing" } })
      .mockReturnValueOnce(progress.promise);
    mocks.post.mockReturnValueOnce(post.promise);
    const onProgress = vi.fn();
    const settled = vi.fn();
    const printing = printBatchWithLocalAgent(jobsFor(), agent, "per_ticket", onProgress)
      .catch((error: unknown) => { settled(error); return error; });
    await vi.advanceTimersByTimeAsync(200);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    const failure = Object.assign(new AxiosError("Printer disconnected", "ECONNRESET"), {
      response: { status: 500, data: { ok: false, completed: response, delivery_state: "unknown" } },
    });
    post.reject(failure);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toHaveBeenCalledExactlyOnceWith(failure);
    const error = await printing;
    expect(error).toBe(failure);
    expect(error).toMatchObject({ completed_jobs: 2, jobs_total: 3 });
    expect(getPrinterDeliveryState(error)).toBe("unknown");
    progress.resolve({ data: { ok: true, completed: 3, status: "done" } });
    await vi.advanceTimersByTimeAsync(0);
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(observed, 3);
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not treat a completed progress observation as success before the authoritative POST settles", async () => {
    const post = deferredValue<{ data: { ok: boolean } }>();
    mocks.get.mockResolvedValueOnce({ data: { ok: true, completed: 3, status: "done" } });
    mocks.post.mockReturnValueOnce(post.promise);
    const settled = vi.fn();
    const printing = printBatchWithLocalAgent(jobsFor(), agent, "per_ticket", vi.fn())
      .then(() => settled("success"), (error: unknown) => { settled(error); return error; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).not.toHaveBeenCalled();
    const failure = Object.assign(new AxiosError("Response lost", "ECONNABORTED"), { delivery_state: "unknown" });
    post.reject(failure);
    await expect(printing).resolves.toBe(failure);
    expect(settled).toHaveBeenCalledExactlyOnceWith(failure);
    expect(failure).toMatchObject({ completed_jobs: 3, jobs_total: 3, delivery_state: "unknown" });
    expect(mocks.post).toHaveBeenCalledOnce();
  });

  it("cancels the progress interval immediately after a successful POST even when progress is unavailable", async () => {
    const post = deferredValue<{ data: { ok: boolean } }>();
    mocks.get.mockRejectedValueOnce(new Error("Older Agent has no progress endpoint"));
    mocks.post.mockReturnValueOnce(post.promise);
    const printing = printBatchWithLocalAgent(jobsFor(), agent, "per_ticket", vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    post.resolve({ data: { ok: true } });
    await printing;
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(mocks.post).toHaveBeenCalledOnce();
  });
});

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { ...actual, default: { get: mocks.get, post: mocks.post } };
});

describe("safe Agent identity preflight", () => {
  const job = {
    agent_id: agent.agent_id, device_code: agent.device_code,
    lang: "la", paper_width_mm: 80, interface_value: "tcp://192.168.1.10:9100",
    printer_type: "thermal", ops: [],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.get.mockReset();
    mocks.post.mockReset();
    browserStorage();
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Macintosh Safari" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("recovers one refused identity read before sending exactly one print POST", async () => {
    mocks.get.mockRejectedValueOnce(new AxiosError("Starting", "ECONNREFUSED"))
      .mockResolvedValueOnce({ data: agent });
    mocks.post.mockResolvedValueOnce({ data: { ok: true } });
    const printing = printWithLocalAgent(job);
    await vi.advanceTimersByTimeAsync(299);
    expect(mocks.post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await printing;
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("shares a pending identity GET between status and dispatch callers", async () => {
    let respond!: (value: { data: typeof agent }) => void;
    mocks.get.mockReturnValueOnce(new Promise((resolve) => { respond = resolve; }));
    const health = checkPrinterAgentConnection();
    const identity = getLocalAgentInfo("http://127.0.0.1:7777/");
    await Promise.resolve();
    expect(mocks.get).toHaveBeenCalledTimes(1);
    respond({ data: agent });
    await expect(health).resolves.toMatchObject({ ok: true, agent });
    await expect(identity).resolves.toEqual(agent);
    mocks.get.mockResolvedValueOnce({ data: agent });
    await getLocalAgentInfo();
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("bounds retries and keeps a timed-out preflight definitely not sent", async () => {
    mocks.get.mockRejectedValue(new AxiosError("Timed out", "ECONNABORTED"));
    const printing = printWithLocalAgent(job);
    const rejected = expect(printing).rejects.toMatchObject({ delivery_state: "not_sent" });
    await vi.advanceTimersByTimeAsync(300);
    await rejected;
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([401, 403])("never retries or prints after Agent authorization denial %s", async (status) => {
    const denied = Object.assign(new AxiosError("Agent access denied", "ERR_BAD_REQUEST"), {
      response: { status, data: { error: "Invalid Agent secret" } },
    });
    mocks.get.mockRejectedValue(denied);
    await expect(printWithLocalAgent(job)).rejects.toMatchObject({ delivery_state: "not_sent" });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.post).not.toHaveBeenCalled();
    await expect(resolvePrinterDeviceIdentity()).resolves.toMatchObject({
      ok: true, connected: false, authorizationFailed: true, error: "Invalid Agent secret",
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("does not retry malformed identity responses", async () => {
    mocks.get.mockResolvedValueOnce({ data: {} });
    await expect(printWithLocalAgent(job)).rejects.toMatchObject({ delivery_state: "not_sent" });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(["read", "write", "no-op"])("keeps a successful physical Agent discovery when identity storage has a %s failure", async (failure) => {
    const storage = browserStorage();
    if (failure === "read") storage.getItem.mockImplementation(() => { throw new Error("Storage access denied"); });
    if (failure === "write") storage.setItem.mockImplementation(() => { throw new Error("Storage quota exceeded"); });
    if (failure === "no-op") storage.setItem.mockImplementation(() => {});
    mocks.get.mockResolvedValue({ data: agent });
    await expect(checkPrinterAgentConnection()).resolves.toMatchObject({ ok: true, agent });
    await expect(getLocalAgentInfo()).resolves.toMatchObject(agent);

    // A subsequent failed read may mark the Agent disconnected, but cannot
    // replace the PC's known device/Agent tuple with a generated browser id.
    mocks.get.mockRejectedValue(new Error("Agent temporarily unavailable"));
    await expect(resolvePrinterDeviceIdentity()).resolves.toMatchObject({
      ok: true, connected: false, agent, error: "Agent temporarily unavailable",
    });
  });

  it("does not borrow a cached identity from another explicit Agent URL", async () => {
    mocks.get.mockResolvedValueOnce({ data: agent });
    await getLocalAgentInfo("http://192.0.2.10:7777");
    mocks.get.mockRejectedValue(new Error("Other Agent unavailable"));
    const result = await resolvePrinterDeviceIdentity("http://192.0.2.11:7777");
    expect(result).toMatchObject({ ok: true, connected: false, agent: { agent_id: "desktop" } });
  });

  it("preserves an actual authorization denial after a trusted discovery with broken persistence", async () => {
    const storage = browserStorage();
    storage.setItem.mockImplementation(() => { throw new Error("Storage full"); });
    mocks.get.mockResolvedValueOnce({ data: agent });
    await getLocalAgentInfo();
    mocks.get.mockRejectedValue(Object.assign(new AxiosError("Forbidden", "ERR_BAD_REQUEST"), {
      response: { status: 403, data: { error: "Invalid Agent secret" } },
    }));
    await expect(resolvePrinterDeviceIdentity()).resolves.toMatchObject({
      ok: true, connected: false, authorizationFailed: true, agent,
    });
    await expect(resolvePosPrinterContext({ login_uuid_fk: "denied-after-cache" })).rejects.toMatchObject({
      payload: { error_code: "PRINTER_AGENT_AUTHORIZATION_FAILED" },
    });
    expect(mocks.get).toHaveBeenCalledTimes(3);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("never repeats a print POST or claims not-sent when its response is lost", async () => {
    mocks.get.mockResolvedValueOnce({ data: agent });
    mocks.post.mockRejectedValueOnce(new AxiosError("Print response timed out", "ECONNABORTED"));
    const error: unknown = await printWithLocalAgent(job).catch((failure: unknown) => failure);
    expect(getPrinterDeliveryState(error)).toBe("unknown");
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("bounds a never-settling identity adapter and starts a fresh read without accepting its late identity", async () => {
    let finishOld!: (value: { data: typeof agent }) => void;
    mocks.get.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
    const first = getLocalAgentInfo();
    const rejected = expect(first).rejects.toMatchObject({ delivery_state: "not_sent" });
    await vi.advanceTimersByTimeAsync(12_000);
    await rejected;
    expect(mocks.get.mock.calls[0]?.[1].signal.aborted).toBe(true);
    const newAgent = { ...agent, agent_id: "new-agent", device_code: "new-device" };
    mocks.get.mockResolvedValueOnce({ data: newAgent });
    await expect(getLocalAgentInfo()).resolves.toEqual(newAgent);
    finishOld({ data: agent });
    await vi.advanceTimersByTimeAsync(0);
    mocks.get.mockRejectedValueOnce(new Error("Agent unavailable"));
    await expect(resolvePrinterDeviceIdentity()).resolves.toMatchObject({ ok: true, connected: false, agent: newAgent });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([120_000, -3_600_000])("replaces a stale shared identity read on wake after clock change %s without old cleanup deleting the fresh read", async (change) => {
    let finishOld!: (value: { data: typeof agent }) => void;
    let finishNew!: (value: { data: typeof agent }) => void;
    mocks.get.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { finishNew = resolve; }));
    const first = getLocalAgentInfo();
    const rejected = expect(first).rejects.toMatchObject({ delivery_state: "not_sent" });
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(Date.now() + change);
    const fresh = getLocalAgentInfo();
    await rejected;
    finishOld({ data: agent });
    await vi.advanceTimersByTimeAsync(0);
    const observer = checkPrinterAgentConnection();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    finishNew({ data: agent });
    await expect(fresh).resolves.toEqual(agent);
    await expect(observer).resolves.toMatchObject({ ok: true, agent });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a buffered identity response after sleep even when the deadline timer has not run", async () => {
    let finish!: (value: { data: typeof agent }) => void;
    mocks.get.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const first = getLocalAgentInfo();
    const rejected = expect(first).rejects.toMatchObject({ delivery_state: "not_sent" });
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(Date.now() + 120_000);
    finish({ data: agent });
    await rejected;
    expect(mocks.post).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

vi.mock("@/lib/api", () => ({
  apiRequest: mocks.apiRequest,
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public statusCode = 500, public originalError?: unknown, public payload?: unknown) {
      super(message);
    }
  },
}));

vi.mock("@/config/printer-agent", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/config/printer-agent")>(),
  AGENT_URL: "http://127.0.0.1:7777",
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.native,
    getPlatform: () => mocks.native ? "android" : "web",
  },
}));

vi.mock("@/services/printer/mobile-tcp", () => ({
  printMobileEscposOverTcp: mocks.printMobileEscposOverTcp,
}));
vi.mock("@/services/printer/sunmi-native", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/printer/sunmi-native")>(),
  printSunmiEscpos: mocks.printSunmiEscpos,
}));

vi.mock("@capacitor/device", () => ({
  Device: { getId: vi.fn(), getInfo: vi.fn() },
}));

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

describe("legacy mobile print dispatch", () => {
  const job = {
    agent_id: "mobile",
    device_code: "android-native-receipt-terminal",
    lang: "la",
    paper_width_mm: 80,
    interface_value: "tcp://192.168.1.10:9100",
    printer_type: "thermal",
    ops: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.native = false;
    mocks.apiRequest.mockReset();
    mocks.post.mockReset();
    mocks.printMobileEscposOverTcp.mockResolvedValue(undefined);
  });

  afterEach(() => { mocks.native = false; });

  it.each(["android-native-terminal", "ios-native-terminal", "android-web-previous"])(
    "renders and sends the native job directly over TCP for %s",
    async (deviceCode) => {
      mocks.native = true;
      mocks.apiRequest.mockResolvedValueOnce({ data: { escpos_base64: "G0AdVgE=" } });
      const nativeJob = { ...job, device_code: deviceCode };

      await dispatchPrintJob(nativeJob);

      expect(mocks.apiRequest).toHaveBeenCalledExactlyOnceWith(
        "post", "/api/v1/printer/mobile/render-escpos", { data: nativeJob },
      );
      expect(mocks.printMobileEscposOverTcp).toHaveBeenCalledExactlyOnceWith({
        interface_value: job.interface_value,
        escpos_base64: "G0AdVgE=",
        require_completion_confirmation: true,
      });
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );

  it.each(["android-native-terminal", "iphone-web-terminal"])(
    "requires the native app before rendering or sending %s",
    async (deviceCode) => {
      await expect(dispatchPrintJob({ ...job, device_code: deviceCode })).rejects.toMatchObject({
        statusCode: 501,
        message: "Physical printing requires the mobile app or a running Printer Agent",
      });

      expect(mocks.apiRequest).not.toHaveBeenCalled();
      expect(mocks.printMobileEscposOverTcp).not.toHaveBeenCalled();
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );

  it("keeps desktop Agent ownership even when its device name contains a native marker", async () => {
    const desktopAgent = { ...agent, device_code: "front-native-terminal" };
    const desktopJob = {
      ...job,
      agent_id: desktopAgent.agent_id,
      device_code: desktopAgent.device_code,
      print_mode: "windows_agent",
    };
    mocks.post.mockResolvedValueOnce({ data: { ok: true } });

    await dispatchPrintJob(desktopJob, desktopAgent);

    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      "http://127.0.0.1:7777/print-ops", desktopJob,
      expect.objectContaining({ headers: { "x-agent-secret": expect.any(String) } }),
    );
    expect(mocks.apiRequest).not.toHaveBeenCalled();
    expect(mocks.printMobileEscposOverTcp).not.toHaveBeenCalled();
  });
});

describe("SUNMI direct diagnostic dispatch", () => {
  const job = { agent_id: "sunmi-native", device_code: "android-native-terminal", print_mode: "sunmi_builtin",
    interface_value: "sunmi://builtin", job_id: "explicit-test-id", print_config_uuid: "printer",
    lang: "la", paper_width_mm: 80, printer_type: "epson", ops: [] };
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiRequest.mockReset();
    mocks.printSunmiEscpos.mockReset().mockResolvedValue(undefined);
  });

  it("renders once then uses only the owner-bound SDK transport", async () => {
    mocks.apiRequest.mockResolvedValueOnce({ data: { escpos_base64: "G0A=" } });
    await dispatchPrintJob(job);
    expect(mocks.printSunmiEscpos).toHaveBeenCalledExactlyOnceWith({
      target: job, escposBase64: "G0A=", jobId: "explicit-test-id:printer",
    });
    expect(mocks.printMobileEscposOverTcp).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("does not dispatch an old session after its server renderer responds", async () => {
    let finish!: (value: { data: { escpos_base64: string } }) => void;
    mocks.apiRequest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const printing = dispatchPrintJob(job);
    const rejected = expect(printing).rejects.toMatchObject({ delivery_state: "not_sent" });
    resetSessionStores();
    finish({ data: { escpos_base64: "G0A=" } });
    await rejected;
    expect(mocks.printSunmiEscpos).not.toHaveBeenCalled();
    expect(mocks.printMobileEscposOverTcp).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
