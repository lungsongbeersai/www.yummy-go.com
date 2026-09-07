import { BACKEND_NETWORK_STATE, type BackendNetworkState } from "@/lib/network-state";

// CHECKING is neither an outage nor a recovery. Keep the episode open until an
// actual Backend response arrives, and do not repeat a toast on locale changes.
export function connectivityNoticeForState(
  state: BackendNetworkState,
  offlineNoticeShown: boolean,
): "offline" | "online" | null {
  if (state === BACKEND_NETWORK_STATE.OFFLINE && !offlineNoticeShown) return "offline";
  if (state === BACKEND_NETWORK_STATE.ONLINE && offlineNoticeShown) return "online";
  return null;
}
