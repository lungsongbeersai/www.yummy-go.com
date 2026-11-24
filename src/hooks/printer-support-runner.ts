import type { AgentInfo, PrinterSupportClaim, PrinterSupportExecution } from "@/services/printer";

interface PrinterSupportRunnerOptions {
  isCurrent: () => boolean;
  resolveOwner: (signal: AbortSignal) => Promise<AgentInfo | null>;
  claim: (agent: AgentInfo, signal: AbortSignal) => Promise<PrinterSupportClaim>;
  execute: (claim: PrinterSupportClaim, agent: AgentInfo, signal: AbortSignal) => Promise<PrinterSupportExecution>;
  acknowledge: (claim: PrinterSupportClaim, result: PrinterSupportExecution, signal: AbortSignal) => Promise<unknown>;
  onError: (error: unknown) => void;
}

export function printerSupportOwnerCapable(agent: AgentInfo | null): agent is AgentInfo {
  return Boolean(agent?.agent_id && agent.device_code && ["win32", "darwin", "linux"].includes(agent.platform ?? "") &&
    agent.supports_printer_support === true && agent.printer_support_protocol_version === 1);
}

// Support uses its own polling lock and deadline. An unavailable support
// endpoint or an admin prompt must never hold the sales printing queue.
export function startPrinterSupportRunner(options: PrinterSupportRunnerOptions) {
  let stopped = false;
  let pending: Promise<void> | null = null;
  let controller: AbortController | null = null;
  const attempted = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const active = () => !stopped && options.isCurrent();
  function poll(): Promise<void> {
    if (!active()) return Promise.resolve();
    if (pending) return pending;
    const current = new AbortController();
    controller = current;
    const started = Date.now();
    const fresh = () => active() && !current.signal.aborted && Date.now() >= started && Date.now() - started < 15000;
    // A read that ignores cancellation still cannot begin Windows work after
    // this deadline, even when its completion is buffered across computer sleep.
    const readTimer = globalThis.setTimeout(() => current.abort(), 15000);
    timers.add(readTimer);
    function cancellable<T>(operation: Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const abort = () => reject(new Error("Printer support request cancelled or expired"));
        if (current.signal.aborted) { abort(); return; }
        current.signal.addEventListener("abort", abort, { once: true });
        operation.then(resolve, reject).finally(() => current.signal.removeEventListener("abort", abort));
      });
    }
    const task = Promise.resolve().then(async () => {
      if (!fresh()) return;
      const agent = await cancellable(options.resolveOwner(current.signal));
      if (!fresh() || !printerSupportOwnerCapable(agent)) return;
      const claim = await cancellable(options.claim(agent, current.signal));
      if (!fresh() || !claim.command || !claim.execution_token) return;
      const command = claim.command;
      if (command.status !== "running" || !Number.isFinite(Date.parse(command.expires_at)) ||
          Date.parse(command.expires_at) <= Date.now() || attempted.has(command.command_uuid)) return;
      attempted.add(command.command_uuid);
      globalThis.clearTimeout(readTimer);
      timers.delete(readTimer);
      const executionTimer = globalThis.setTimeout(() => current.abort(), 100000);
      timers.add(executionTimer);
      try {
        let result: PrinterSupportExecution;
        try { result = await cancellable(options.execute(claim, agent, current.signal)); }
        catch { result = { status: "unknown", error_code: "SUPPORT_EXECUTION_UNCERTAIN" }; }
        if (!active() || current.signal.aborted) return;
        // A failed ACK is reported, never used as a reason to execute again.
        await cancellable(options.acknowledge(claim, result, current.signal));
      } finally { globalThis.clearTimeout(executionTimer); timers.delete(executionTimer); }
    }).catch((error: unknown) => { if (active() && !current.signal.aborted) options.onError(error); })
      .finally(() => {
        globalThis.clearTimeout(readTimer);
        timers.delete(readTimer);
        if (pending === task) { pending = null; controller = null; }
      });
    pending = task;
    return task;
  }
  const interval = globalThis.setInterval(() => { void poll(); }, 15000);
  void poll();
  return { poll, stop() { stopped = true; globalThis.clearInterval(interval); controller?.abort(); for (const timer of timers) globalThis.clearTimeout(timer); timers.clear(); } };
}
