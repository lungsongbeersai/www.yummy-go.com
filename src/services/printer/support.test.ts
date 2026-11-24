import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { apiRequest } from "@/lib/api";
import { AGENT_URL } from "@/config/printer-agent";
import { claimPrinterSupportCommand, createPrinterSupportCommand, executePrinterSupportCommand, getPrinterSupportCommand, getPrinterSupportSummary, parsePrinterSupportResult } from "./support";
import type { AgentInfo, PrinterSupportClaim } from "./types";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), ServiceError: class extends Error { constructor(message: string, public statusCode = 500) { super(message); } } }));
const printerUuid = "22222222-2222-4222-8222-222222222222";
const agent: AgentInfo = { agent_id: "shop-agent", device_code: "SHOP-PC", agent_name: "Shop", platform: "win32" };
const command = { command_uuid: "11111111-1111-4111-8111-111111111111", print_config_uuid: printerUuid,
  action: "diagnose" as const, status: "running" as const, created_at: "2026-11-23T08:00:00Z", expires_at: "2026-11-23T08:02:00Z", finished_at: null, error_code: null, result: null };
const claim: PrinterSupportClaim = { command, execution_token: "opaque-token" };
const result = { code: "NETWORK_DIAGNOSED", checked_at: "2026-11-23T08:00:01Z", platform: "win32", admin: false, changed: false, rollback_available: false,
  tcp: { state: "refused", bytes_sent: 0 }, neighbor: { mac: "A0-9A-0C-72-73-C0", state: "Stale" }, network: { interface_index: 4, local_ipv4: "192.168.100.207", prefix_length: 24 } };

describe("remote printer support service contract", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses Backend for an offsite summary and rejects another printer's history", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { printer: { print_config_uuid: printerUuid, printer_name: "Somtam", interface_value: "tcp://192.168.100.201:9100", agent_online: true },
      recent: { success: 1, pending: 0, failed: 1, unknown: 0, last_error: null, last_error_at: null }, commands: [command] } });
    const summary = await getPrinterSupportSummary(printerUuid);
    expect(summary.printer.agent_online).toBe(true);
    expect(apiRequest).toHaveBeenCalledWith("get", "/api/v1/printer/support/summary", expect.objectContaining({ params: { print_config_uuid: printerUuid } }));
    vi.mocked(apiRequest).mockResolvedValue({ data: { printer: { print_config_uuid: "other", printer_name: "Other", interface_value: "tcp://other:9100" }, recent: {}, commands: [] } });
    await expect(getPrinterSupportSummary(printerUuid)).rejects.toThrow("Invalid printer support response");
  });
  it("rejects a mismatched command response and malformed claim token", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { ...command, command_uuid: "33333333-3333-4333-8333-333333333333" } });
    await expect(getPrinterSupportCommand(command.command_uuid)).rejects.toThrow();
    vi.mocked(apiRequest).mockResolvedValue({ data: { command } });
    await expect(claimPrinterSupportCommand(agent, new AbortController().signal)).rejects.toThrow();
  });
  it("queues an explicit idempotency key without any shell or network target from the form", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: command });
    const input = { print_config_uuid: printerUuid, action: "diagnose" as const, request_uuid: "44444444-4444-4444-8444-444444444444" };
    await createPrinterSupportCommand(input);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("post", "/api/v1/printer/support/commands", expect.objectContaining({ data: input }));
  });
  it("sends only the opaque claim and expected owner identity to the fixed local Agent", async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: { ok: true, agent, data: result } });
    const execution = await executePrinterSupportCommand(claim, agent, new AbortController().signal);
    expect(execution.status).toBe("succeeded");
    expect(execution.result?.tcp?.state).toBe("refused");
    const [url, body, options] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe(`${AGENT_URL.replace(/\/$/, "")}/printer/support/execute`);
    expect(body).toEqual({ command_uuid: command.command_uuid, execution_token: claim.execution_token, expected_agent_id: agent.agent_id, expected_device_code: agent.device_code });
    expect(options?.headers).not.toHaveProperty("Authorization");
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it("treats a lost response or wrong Agent identity as uncertain with no retry", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("network response lost"));
    expect((await executePrinterSupportCommand(claim, agent, new AbortController().signal)).status).toBe("unknown");
    expect(axios.post).toHaveBeenCalledTimes(1);
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: { ok: true, agent: { ...agent, device_code: "OTHER" }, data: result } });
    expect((await executePrinterSupportCommand(claim, agent, new AbortController().signal)).status).toBe("unknown");
  });
  it.each(["SUPPORT_EXECUTION_UNKNOWN", "SUPPORT_EXECUTION_UNCERTAIN", "SUPPORT_ROLLBACK_FAILED"])("never turns %s into success even if an Agent incorrectly sends ok=true", async (code) => {
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: { ok: true, agent, data: { ...result, code } } });
    expect((await executePrinterSupportCommand(claim, agent, new AbortController().signal)).status).toBe("unknown");
  });
  it("reports a known admin failure without falsely claiming that a network change succeeded", async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 409, data: { ok: false, agent, code: "SUPPORT_ADMIN_REQUIRED", data: { ...result, code: "SUPPORT_ADMIN_REQUIRED" } } });
    const execution = await executePrinterSupportCommand(claim, agent, new AbortController().signal);
    expect(execution).toMatchObject({ status: "failed", error_code: "SUPPORT_ADMIN_REQUIRED" });
  });
  it("accepts non-Windows diagnosis with a null interface index, but rejects probes that claim to send print bytes", () => {
    expect(parsePrinterSupportResult({ ...result, platform: "darwin", network: { ...result.network, interface_index: null } }).network?.interface_index).toBeNull();
    expect(() => parsePrinterSupportResult({ ...result, tcp: { state: "open", bytes_sent: 1 } })).toThrow();
  });
});
