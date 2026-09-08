export const OFFLINE_DATA_REFRESH_EVENT = "yummy-go:offline-data-refresh";

export function requestOfflineDataRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_DATA_REFRESH_EVENT));
}
