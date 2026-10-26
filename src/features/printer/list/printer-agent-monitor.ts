const REFRESH_INTERVAL_MS = 30_000;
const REFRESH_THROTTLE_MS = 3_000;

// Focus, visibility and native resume often arrive together. Coalesce them
// without reloading printer configuration or changing any printer settings.
export function monitorPrinterAgentConnection(refresh: () => Promise<unknown>) {
  let stopped = false;
  let pending: Promise<void> | null = null;
  let lastStarted = Number.NEGATIVE_INFINITY;

  const check = () => {
    if (stopped || document.visibilityState === "hidden") return Promise.resolve();
    if (pending) return pending;
    const age = Date.now() - lastStarted;
    if (age >= 0 && age < REFRESH_THROTTLE_MS) return Promise.resolve();
    lastStarted = Date.now();
    pending = Promise.resolve().then(() => stopped ? undefined : refresh()).then(() => undefined, () => undefined).finally(() => {
      pending = null;
    });
    return pending;
  };
  const onWake = () => { void check(); };
  window.addEventListener("focus", onWake);
  window.addEventListener("online", onWake);
  document.addEventListener("visibilitychange", onWake);
  const interval = window.setInterval(onWake, REFRESH_INTERVAL_MS);

  return {
    refresh: check,
    stop: () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
    },
  };
}
