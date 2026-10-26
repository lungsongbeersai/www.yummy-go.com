import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { AGENT_URL } from "@/config/printer-agent";
import { getPrinterReadiness } from "@/services/printer/diagnostics";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { ...actual, default: { ...actual.default, get: vi.fn() } };
});

const input = { interface_value: "cups:Receipt", expected_agent_id: "local", expected_device_code: "MAC1" };
const response = () => ({ data: { ok: true, agent: { agent_id: "local", device_code: "MAC1" }, data: {
  state: "blocked", kind: "cups", printer_name: "Receipt", reason: "printer_paused", queued_job_count: 1,
} } });

beforeEach(() => { vi.mocked(axios.get).mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe("printer queue diagnostics", () => {
  it("reads the selected local queue with its expected device tuple and no print command", async () => {
    vi.mocked(axios.get).mockResolvedValue(response());
    await expect(getPrinterReadiness(input)).resolves.toMatchObject({ state: "blocked", reason: "printer_paused", queued_job_count: 1 });
    expect(axios.get).toHaveBeenCalledExactlyOnceWith(`${AGENT_URL.replace(/\/+$/, "")}/printer/readiness`, {
      params: input, headers: { "x-agent-secret": expect.any(String) }, timeout: 5000, signal: expect.any(AbortSignal),
    });
  });

  it("uses the explicitly checked connection URL and never a saved printer owner URL", async () => {
    vi.mocked(axios.get).mockResolvedValue(response());
    await getPrinterReadiness(input, { agentUrl: "http://127.0.0.1:8888/" });
    expect(axios.get).toHaveBeenCalledWith("http://127.0.0.1:8888/printer/readiness", expect.any(Object));
  });

  it.each(["agent", "device", "queue", "kind", "missing queue"])("refuses a foreign or incomplete %s response", async (mismatch) => {
    const payload = response();
    if (mismatch === "agent") payload.data.agent.agent_id = "other";
    if (mismatch === "device") payload.data.agent.device_code = "other";
    if (mismatch === "queue") payload.data.data.printer_name = "Other";
    if (mismatch === "kind") payload.data.data.kind = "win";
    if (mismatch === "missing queue") Reflect.deleteProperty(payload.data.data, "printer_name");
    vi.mocked(axios.get).mockResolvedValue(payload);
    await expect(getPrinterReadiness(input)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("keeps an older Agent's unsupported endpoint unknown without declaring the printer ready", async () => {
    vi.mocked(axios.get).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
    await expect(getPrinterReadiness(input)).resolves.toEqual({ state: "unknown", reason: "printer_readiness_unsupported" });
  });

  it("does not query malformed or nonqueue targets", async () => {
    for (const interface_value of ["tcp://192.168.1.7:9100", "cups:\nReceipt", ""]) {
      await expect(getPrinterReadiness({ ...input, interface_value })).resolves.toMatchObject({ state: "not_applicable" });
    }
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("ends a status read even when its HTTP adapter ignores abort and timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    const check = getPrinterReadiness(input);
    const rejection = expect(check).rejects.toMatchObject({ statusCode: 503 });
    await vi.advanceTimersByTimeAsync(5500);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
    const options = vi.mocked(axios.get).mock.calls[0][1];
    expect(options?.signal?.aborted).toBe(true);
  });
});
