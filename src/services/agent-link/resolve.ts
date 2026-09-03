// Where this device finds its Printer Agent.
//
// The Agent is the branch's offline hub: it owns the local SQLite, the outbox,
// the print queue and the sync back to Backend. A desktop runs its own on
// loopback. A phone has none, so it uses the branch's over the LAN — the same
// endpoints, a different host, plus the shared secret that loopback callers are
// exempt from.

export interface AgentLink {
  baseUrl: string;
  /** null on loopback, where the Agent trusts the caller without one. */
  secret: string | null;
}

export const PAIRED_AGENT_STORAGE_KEY = "yummy-go-paired-agent";

function trimmedUrl(value: unknown) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

/**
 * A LAN Agent must be reachable by address. Loopback is meaningless from a
 * phone — it would resolve to the phone itself — and a hostname the WebView
 * cannot resolve without DNS is no better, so pairing keeps to IP literals.
 */
export function isUsableLanAgentUrl(value: unknown): boolean {
  const url = trimmedUrl(value);
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname;
  if (host === "127.0.0.1" || host === "::1" || host === "localhost") return false;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d/.test(host) ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export function parsePairedAgent(raw: unknown): AgentLink | null {
  if (typeof raw !== "string" || !raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const baseUrl = trimmedUrl(record.baseUrl);
  const secret = String(record.secret ?? "").trim();
  if (!isUsableLanAgentUrl(baseUrl) || !secret) return null;
  return { baseUrl, secret };
}

/**
 * Resolve the Agent this device should talk to. Returns null when there is
 * none — a phone that has never been paired — so callers can fall back instead
 * of firing requests at an address that cannot answer.
 */
export function resolveAgentLink({
  isNative,
  paired,
  loopbackUrl,
}: {
  isNative: boolean;
  paired: AgentLink | null;
  loopbackUrl: string;
}): AgentLink | null {
  // Desktop and web keep the loopback Agent exactly as before.
  if (!isNative) return { baseUrl: trimmedUrl(loopbackUrl), secret: null };
  return paired;
}
