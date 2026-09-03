import { AGENT_URL } from "@/config/printer-agent";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import {
  PAIRED_AGENT_STORAGE_KEY,
  parsePairedAgent,
  resolveAgentLink,
  type AgentLink,
} from "./resolve";

// Pairing is per device and survives restarts, so it lives in localStorage next
// to the auth session rather than in Dexie: the Agent address is needed before
// any database work can start, including the offline login that reads it.

export function readPairedAgent(): AgentLink | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return parsePairedAgent(localStorage.getItem(PAIRED_AGENT_STORAGE_KEY));
  } catch {
    // Private mode and cleared site data both surface here; treat as unpaired.
    return null;
  }
}

export function writePairedAgent(link: AgentLink) {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(PAIRED_AGENT_STORAGE_KEY, JSON.stringify(link));
    return true;
  } catch {
    return false;
  }
}

export function clearPairedAgent() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PAIRED_AGENT_STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/** The Agent this device should use now, or null when it has none. */
export function currentAgentLink(): AgentLink | null {
  return resolveAgentLink({
    isNative: isCapacitorNativeApp(),
    paired: readPairedAgent(),
    loopbackUrl: AGENT_URL,
  });
}
