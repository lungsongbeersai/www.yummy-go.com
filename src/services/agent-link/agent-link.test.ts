import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentRequestError,
  agentRejected,
  isUsableLanAgentUrl,
  parsePairedAgent,
  resolveAgentLink,
} from "@/services/agent-link";

const LOOPBACK = "http://127.0.0.1:7777";
const LAN = { baseUrl: "http://192.168.1.20:7777", secret: "branch-agent-secret-abcdefghij" };

describe("resolving the branch Agent", () => {
  it("keeps desktop and web on the loopback Agent with no secret", () => {
    expect(resolveAgentLink({ isNative: false, paired: null, loopbackUrl: LOOPBACK }))
      .toEqual({ baseUrl: LOOPBACK, secret: null });
    // A pairing on a desktop must not redirect it away from its own Agent.
    expect(resolveAgentLink({ isNative: false, paired: LAN, loopbackUrl: LOOPBACK }))
      .toEqual({ baseUrl: LOOPBACK, secret: null });
  });

  it("sends a paired phone to the branch Agent over the LAN", () => {
    expect(resolveAgentLink({ isNative: true, paired: LAN, loopbackUrl: LOOPBACK })).toEqual(LAN);
  });

  it("reports no Agent for a phone that was never paired", () => {
    // Loopback on a phone is the phone itself, so falling back to it would send
    // every offline request into a black hole.
    expect(resolveAgentLink({ isNative: true, paired: null, loopbackUrl: LOOPBACK })).toBeNull();
  });
});

describe("pairing input", () => {
  it("accepts a private LAN address", () => {
    expect(isUsableLanAgentUrl("http://192.168.1.20:7777")).toBe(true);
    expect(isUsableLanAgentUrl("http://10.0.0.5:7777")).toBe(true);
    expect(isUsableLanAgentUrl("http://172.16.4.9:7777")).toBe(true);
  });

  it("rejects loopback, which on a phone means the phone", () => {
    expect(isUsableLanAgentUrl("http://127.0.0.1:7777")).toBe(false);
    expect(isUsableLanAgentUrl("http://localhost:7777")).toBe(false);
  });

  it("rejects anything that is not an http(s) address", () => {
    expect(isUsableLanAgentUrl("")).toBe(false);
    expect(isUsableLanAgentUrl("192.168.1.20:7777")).toBe(false);
    expect(isUsableLanAgentUrl("ftp://192.168.1.20")).toBe(false);
    expect(isUsableLanAgentUrl("javascript:alert(1)")).toBe(false);
  });

  it("only restores a stored pairing that still has both parts", () => {
    expect(parsePairedAgent(JSON.stringify(LAN))).toEqual(LAN);
    expect(parsePairedAgent(JSON.stringify({ baseUrl: LAN.baseUrl }))).toBeNull();
    expect(parsePairedAgent(JSON.stringify({ secret: LAN.secret }))).toBeNull();
    expect(parsePairedAgent(JSON.stringify({ ...LAN, baseUrl: LOOPBACK }))).toBeNull();
    expect(parsePairedAgent("not json")).toBeNull();
    expect(parsePairedAgent(null)).toBeNull();
  });
});

describe("telling a rejection from an unreachable Agent", () => {
  it("treats an Agent that answered with an error as a verdict", () => {
    expect(agentRejected(new AgentRequestError("boom", { responded: true, status: 409 }))).toBe(true);
  });

  it("treats an unreachable Agent as no verdict at all", () => {
    expect(agentRejected(new AgentRequestError("no route", { responded: false }))).toBe(false);
    expect(agentRejected(new Error("something else"))).toBe(false);
  });

  it("still understands the axios shape the loopback transport throws", () => {
    const responded = new axios.AxiosError("rejected");
    responded.response = { status: 400 } as never;
    expect(agentRejected(responded)).toBe(true);
    expect(agentRejected(new axios.AxiosError("Network Error"))).toBe(false);
  });
});

describe("native transport", () => {
  const request = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    request.mockReset();
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true },
      CapacitorHttp: { request },
    }));
  });

  afterEach(() => {
    vi.doUnmock("@capacitor/core");
    vi.resetModules();
  });

  async function nativeAgentRequest() {
    const { agentRequest } = await import("@/services/agent-link/transport");
    return agentRequest;
  }

  it("carries the shared secret the Agent requires from a LAN caller", async () => {
    request.mockResolvedValue({ status: 200, data: { ok: true } });
    const call = await nativeAgentRequest();

    await call(LAN, { method: "POST", path: "/local/api", data: { a: 1 } });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      url: "http://192.168.1.20:7777/local/api",
      headers: expect.objectContaining({ "x-agent-secret": LAN.secret }),
      data: { a: 1 },
    }));
  });

  it("reads a non-2xx as a rejection, since native resolves every status", async () => {
    request.mockResolvedValue({ status: 401, data: { error: "unauthorized" } });
    const call = await nativeAgentRequest();

    await expect(call(LAN, { method: "POST", path: "/local/api" }))
      .rejects.toMatchObject({ responded: true, status: 401 });
  });

  it("reads a thrown native error as unreachable, so the event stays staged", async () => {
    request.mockRejectedValue(new Error("failed to connect"));
    const call = await nativeAgentRequest();

    await expect(call(LAN, { method: "POST", path: "/local/api" }))
      .rejects.toMatchObject({ responded: false });
  });
});
