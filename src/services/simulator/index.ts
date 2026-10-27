import { apiRequest } from "@/lib/api";
import { requiredText } from "@/services/shared/validators";
import type { SimulatorAction, SimulatorBootstrap, SimulatorSession, SimulatorSessionSummary } from "./types";

export type * from "./types";

interface SimulatorResponse<T> { status: "success"; data: T; }
const base = "/api/v1/simulator";

export async function getSimulatorBootstrap(branch_uuid: string) {
  requiredText(branch_uuid, "branch_uuid");
  const result = await apiRequest<SimulatorResponse<SimulatorBootstrap>>("get", `${base}/bootstrap`, {
    params: { branch_uuid }, timeout: 15_000,
  });
  return result.data;
}

export async function listSimulatorSessions(branch_uuid: string) {
  const result = await apiRequest<SimulatorResponse<SimulatorSessionSummary[]>>("get", `${base}/sessions`, {
    params: { branch_uuid }, timeout: 15_000,
  });
  return result.data;
}

export async function createSimulatorSession(branch_uuid: string, name?: string) {
  const result = await apiRequest<SimulatorResponse<SimulatorSession>>("post", `${base}/sessions`, {
    data: { branch_uuid, ...(name ? { name } : {}) }, timeout: 15_000,
  });
  return result.data;
}

export async function getSimulatorSession(session_uuid: string, signal?: AbortSignal) {
  requiredText(session_uuid, "session_uuid");
  const result = await apiRequest<SimulatorResponse<SimulatorSession>>("get", `${base}/sessions/${encodeURIComponent(session_uuid)}`, {
    timeout: 15_000, signal,
  });
  return result.data;
}

export async function runSimulatorAction(session_uuid: string, action: SimulatorAction) {
  requiredText(session_uuid, "session_uuid");
  const result = await apiRequest<SimulatorResponse<SimulatorSession>>("post", `${base}/sessions/${encodeURIComponent(session_uuid)}/actions`, {
    data: action, timeout: 15_000,
  });
  return result.data;
}

export async function watchSimulatorSession(session_uuid: string, version: number, signal: AbortSignal) {
  const result = await apiRequest<SimulatorResponse<SimulatorSession>>("get", `${base}/sessions/${encodeURIComponent(session_uuid)}/events`, {
    params: { version }, timeout: 25_000, signal,
  });
  return result.data;
}
