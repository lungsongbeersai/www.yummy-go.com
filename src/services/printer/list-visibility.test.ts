import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isLanSharedPrinter, resolvePrinterListVisibility } from "./list-visibility";
import type { AgentInfo, Printer } from "./types";

const owner = { agent_id: "owner-agent", device_code: "OWNER-PC" };
const agent: AgentInfo = { ...owner, agent_name: "Owner", platform: "win32" };
const fetchMock = vi.fn<typeof fetch>();

function printer(overrides: Partial<Printer> = {}): Printer {
  return {
    print_config_uuid: "printer-1", printer_name: "Receipt", connect_type: "tcp",
    interface_value: "tcp://192.168.1.104:9100", paper_width_mm: 80,
    is_active: true, role_codes: ["receipt"], cate_uuid_fk: [], access_mode: "LAN",
    is_shared: true, sharing_mode: "SHARED", agent_url: "http://192.168.1.20:7777",
    agent_id: owner.agent_id, device_code: owner.device_code, owner_device_code: owner.device_code,
    ...overrides,
  };
}

function health(identity: unknown = owner, ok = true) {
  return new Response(JSON.stringify({ ok, agent: identity }), { status: 200 });
}

describe("printer list network visibility", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps INTERNET and DIRECT visible without inspecting another network", async () => {
    const internet = printer({ print_config_uuid: "internet", access_mode: "INTERNET", agent_online: false });
    const direct = printer({ print_config_uuid: "direct", access_mode: "DIRECT" });
    expect(isLanSharedPrinter(internet)).toBe(false);
    expect(isLanSharedPrinter(direct)).toBe(false);
    expect(await resolvePrinterListVisibility([internet, direct], { agent: null, connected: false })).toEqual({
      internet: { state: "local", reason: "internet" }, direct: { state: "local", reason: "device" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires both current owner identities and a fresh connected context", async () => {
    const own = printer();
    expect(await resolvePrinterListVisibility([own], { agent, connected: true })).toMatchObject({
      "printer-1": { state: "local", reason: "owner_device" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(health({ ...owner, device_code: "OTHER-PC" }));
    expect(await resolvePrinterListVisibility([own], { agent, connected: false })).toMatchObject({
      "printer-1": { state: "unknown", reason: "owner_identity_mismatch" },
    });
    expect(await resolvePrinterListVisibility([own], { agent: { ...agent, device_code: "OTHER-PC" }, connected: true })).toMatchObject({
      "printer-1": { state: "unknown" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("proves a foreign owner only with a credentialless identity GET, regardless of stored heartbeat", async () => {
    const rows = [printer({ agent_online: false })];
    const snapshot = structuredClone(rows);
    Object.freeze(rows[0]);
    Object.freeze(rows);
    fetchMock.mockResolvedValueOnce(health());
    const results = await resolvePrinterListVisibility(rows, { agent: null, connected: false });
    expect(results).toEqual({ "printer-1": { state: "local", reason: "owner_verified" } });
    expect(rows).toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("http://192.168.1.20:7777/health", {
      method: "GET", credentials: "omit", mode: "cors", cache: "no-store",
      redirect: "error", referrerPolicy: "no-referrer", signal: expect.any(AbortSignal),
    });
    const options = fetchMock.mock.calls[0]?.[1];
    expect(options?.headers).toBeUndefined();
    expect(options?.body).toBeUndefined();
  });

  it.each([
    { agent_id: "different-agent", device_code: owner.device_code },
    { agent_id: owner.agent_id, device_code: "different-device" },
  ])("refuses an address now belonging to another owner on the same subnet: %j", async (identity) => {
    fetchMock.mockResolvedValueOnce(health(identity));
    expect(await resolvePrinterListVisibility([printer({ agent_online: true })], {
      agent: { ...agent, agent_id: "current-agent", device_code: "CURRENT-PC", network_addresses: ["192.168.1.50"] },
      connected: true,
    })).toEqual({ "printer-1": { state: "unknown", reason: "owner_identity_mismatch" } });
  });

  it.each([{}, { device_code: owner.device_code }, { agent_id: owner.agent_id }, null])("does not accept older or malformed health identity: %j", async (identity) => {
    fetchMock.mockResolvedValueOnce(health(identity));
    expect(await resolvePrinterListVisibility([printer()], { agent: null, connected: false })).toMatchObject({
      "printer-1": { state: "unknown", reason: "owner_unconfirmed" },
    });
  });

  it("requires saved owner identity and never infers it from printer IP or cached context", async () => {
    const result = await resolvePrinterListVisibility([
      printer({ print_config_uuid: "missing-agent", agent_id: undefined }),
      printer({ print_config_uuid: "missing-device", owner_device_code: undefined, device_code: undefined }),
      printer({ print_config_uuid: "missing-url", agent_url: undefined }),
    ], { agent: null, connected: false });
    expect(result).toEqual({
      "missing-agent": { state: "unknown", reason: "owner_identity_missing" },
      "missing-device": { state: "unknown", reason: "owner_identity_missing" },
      "missing-url": { state: "unknown", reason: "owner_address_unavailable" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://127.0.0.1:7777", "http://localhost:7777", "http://owner.local:7777",
    "http://8.8.8.8:7777", "http://169.254.1.2:7777", "http://172.32.1.2:7777",
    "http://user:secret@192.168.1.20:7777", "http://192.168.1.20:7777?token=secret",
    "http://192.168.1.20:7777/#fragment", "http://192.168.1.20:7777/print-ops",
    "http://192.168.1.20:9100", "tcp://192.168.1.20:7777", "file:///health",
    "http://3232235796:7777", "http://192.168.001.20:7777", "http://192.168.1.20:07777",
    "http://192.168.1.20:0", "http://192.168.1.20:65536",
  ])("never probes an unsafe or non-Agent address %s", async (url) => {
    const results = await resolvePrinterListVisibility([printer({ agent_url: url })], { agent: null, connected: false });
    expect(results["printer-1"]).toEqual({ state: "unknown", reason: "owner_address_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses one saved resolved or registered Agent URL without scanning alternative addresses", async () => {
    fetchMock.mockResolvedValue(health());
    await resolvePrinterListVisibility([
      printer({ resolved_agent_url: "https://10.1.2.3:7777/", registered_agent_url: "http://172.16.1.2:7777" }),
      printer({ print_config_uuid: "registered", agent_url: undefined, registered_agent_url: "http://172.16.1.2:7777" }),
    ], { agent: null, connected: false });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://10.1.2.3:7777/health", "http://172.16.1.2:7777/health",
    ]);
  });

  it("keeps blocked, redirected, invalid JSON and unsuccessful reads unknown", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Browser network access denied"))
      .mockRejectedValueOnce(new TypeError("Redirect rejected"))
      .mockResolvedValueOnce(new Response("invalid JSON"))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }))
      .mockResolvedValueOnce(health(owner, false));
    for (let index = 0; index < 5; index++) {
      expect((await resolvePrinterListVisibility([printer()], { agent: null, connected: false }))["printer-1"].state)
        .toBe("unknown");
    }
    expect(fetchMock.mock.calls.every(([, options]) => options?.redirect === "error" && options.method === "GET")).toBe(true);
  });

  it("bounds fetch and response-body reads even when an adapter ignores abort", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
    const pending = resolvePrinterListVisibility([printer()], { agent: null, connected: false });
    await vi.advanceTimersByTimeAsync(1800);
    expect(await pending).toEqual({ "printer-1": { state: "unknown", reason: "check_timed_out" } });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);

    const response = health();
    vi.spyOn(response, "json").mockImplementation(() => new Promise<unknown>(() => {}));
    fetchMock.mockResolvedValueOnce(response);
    const stalledBody = resolvePrinterListVisibility([printer()], { agent: null, connected: false });
    await vi.advanceTimersByTimeAsync(1800);
    expect(await stalledBody).toEqual({ "printer-1": { state: "unknown", reason: "check_timed_out" } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts an in-flight read and never starts queued probes after cancellation", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    const rows = Array.from({ length: 8 }, (_, index) => printer({
      print_config_uuid: `printer-${index}`, agent_url: `http://192.168.1.${20 + index}:7777`,
    }));
    const pending = resolvePrinterListVisibility(rows, { agent: null, connected: false }, controller.signal);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    controller.abort();
    const result = await pending;
    expect(Object.values(result)).toHaveLength(8);
    expect(Object.values(result).every((status) => status.reason === "check_aborted")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.every(([, options]) => options?.signal?.aborted)).toBe(true);
    fetchMock.mockClear();
    await resolvePrinterListVisibility(rows, { agent: null, connected: false }, controller.signal);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares only identical URL and owner tuples within a batch, with no lasting proof cache", async () => {
    fetchMock.mockImplementation(async () => health());
    const rows = [printer(), printer({ print_config_uuid: "same-owner", agent_url: "http://192.168.1.20:7777/" })];
    const result = await resolvePrinterListVisibility(rows, { agent: null, connected: false });
    expect(result["same-owner"]).toEqual(result["printer-1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await resolvePrinterListVisibility([printer({ agent_id: "different-agent" }), ...rows], { agent: null, connected: false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("limits concurrent probes to four", async () => {
    let active = 0;
    let maximum = 0;
    const settle: Array<() => void> = [];
    fetchMock.mockImplementation(() => {
      active += 1;
      maximum = Math.max(maximum, active);
      return new Promise<Response>((resolve) => settle.push(() => { active -= 1; resolve(health()); }));
    });
    const rows = Array.from({ length: 9 }, (_, index) => printer({
      print_config_uuid: `printer-${index}`, agent_url: `http://192.168.1.${20 + index}:7777`,
    }));
    const pending = resolvePrinterListVisibility(rows, { agent: null, connected: false });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    settle.splice(0).forEach((resolve) => resolve());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(8));
    settle.splice(0).forEach((resolve) => resolve());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(9));
    settle.splice(0).forEach((resolve) => resolve());
    expect(Object.values(await pending).every((status) => status.state === "local")).toBe(true);
    expect(maximum).toBe(4);
  });

  it("recognizes old SHARED records without treating local-network hints as proof", async () => {
    const legacy = printer({ access_mode: undefined, is_shared: undefined });
    expect(isLanSharedPrinter(legacy)).toBe(true);
    fetchMock.mockRejectedValueOnce(new Error("Owner absent from this physical network"));
    expect(await resolvePrinterListVisibility([legacy], {
      agent: { ...agent, agent_id: "here", device_code: "HERE", network_addresses: ["192.168.1.20"] }, connected: true,
    })).toEqual({ "printer-1": { state: "unknown", reason: "owner_unreachable" } });
  });
});
