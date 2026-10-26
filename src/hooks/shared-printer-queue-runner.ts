import type { AgentInfo, PendingPrintJobRef } from "@/services/printer";

const POLL_INTERVAL_MS = 30_000;
const IDENTITY_REFRESH_MS = 10_000;
const OWNER_READ_TIMEOUT_MS = 15_000;
const POLL_READ_TIMEOUT_MS = 45_000;

interface BoundedRead<T> {
  promise: Promise<T>;
  isFresh: () => boolean;
  abort: () => void;
}

function boundedRead<T>(read: (signal: AbortSignal) => Promise<T>, timeoutMs: number): BoundedRead<T> {
  const controller = new AbortController();
  const startedAt = Date.now();
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  let rejectRead: (error: Error) => void;
  const isFresh = () => {
    const age = Date.now() - startedAt;
    return !controller.signal.aborted && age >= 0 && age < timeoutMs;
  };
  const abort = () => {
    controller.abort();
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    rejectRead(new Error("Shared printer readiness read expired or was cancelled"));
  };
  const promise = new Promise<T>((resolve, reject) => {
    rejectRead = reject;
    timer = setTimeout(abort, timeoutMs);
    void Promise.resolve().then(() => {
      if (!isFresh()) { abort(); throw new Error("Shared printer readiness read was cancelled"); }
      return read(controller.signal);
    }).then((value) => {
      // A sleep can delay the timer behind a buffered HTTP completion. Wall
      // time must still prove this read is fresh before any job is dispatched.
      if (!isFresh()) { abort(); return; }
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
  return { promise, isFresh, abort };
}

interface SharedPrinterQueueRunnerOptions {
  nativeMobile: boolean;
  isVisible: () => boolean;
  resolveOwner: (signal: AbortSignal) => Promise<AgentInfo | null>;
  fetchPending: (agent: AgentInfo, signal: AbortSignal) => Promise<PendingPrintJobRef[]>;
  isLocalOwner: (ref: PendingPrintJobRef, agent: AgentInfo) => boolean;
  execute: (ref: PendingPrintJobRef, agent: AgentInfo) => Promise<unknown>;
  onPollError: (error: unknown) => void;
  onExecutionError: (ref: PendingPrintJobRef, error: unknown) => void;
}

// Presence belongs to the refs lookup, so a physical print must never hold the
// polling lock. All state belongs to this session's runner; old completions
// cannot release a new login's polling lock or erase its in-flight jobs.
export function startSharedPrinterQueueRunner(options: SharedPrinterQueueRunnerOptions) {
  let stopped = false;
  let pendingPoll: { read: BoundedRead<void>; request: Promise<void> } | null = null;
  let pendingOwner: { read: BoundedRead<AgentInfo | null>; request: Promise<AgentInfo | null> } | null = null;
  let owner: { agent: AgentInfo; checkedAt: number } | null = null;
  const inFlight = new Set<string>();

  // A desktop Agent still serves the shop when its browser tab is hidden.
  // Native mobile owns its TCP transport and pauses new work in the background.
  const canWork = () => !stopped && (!options.nativeMobile || options.isVisible());

  function localOwner() {
    if (!canWork()) return Promise.resolve(null);
    const age = owner ? Date.now() - owner.checkedAt : -1;
    if (owner && age >= 0 && age < IDENTITY_REFRESH_MS) return Promise.resolve(owner.agent);
    if (pendingOwner && !pendingOwner.read.isFresh()) {
      pendingOwner.read.abort();
      pendingOwner = null;
    }
    if (pendingOwner) return pendingOwner.request;

    const read = boundedRead((signal) => canWork() ? options.resolveOwner(signal) : Promise.resolve(null), OWNER_READ_TIMEOUT_MS);
    const request = read.promise.then((agent) => {
      if (stopped || pendingOwner?.read !== read || !read.isFresh()) return null;
      owner = agent ? { agent, checkedAt: Date.now() } : null;
      return agent;
    }).finally(() => {
      if (pendingOwner?.read === read) pendingOwner = null;
    });
    pendingOwner = { read, request };
    return request;
  }

  function dispatch(ref: PendingPrintJobRef, agent: AgentInfo, isFresh: () => boolean) {
    const jobUuid = String(ref.print_job_uuid ?? "").trim();
    if (!canWork() || !isFresh() || !jobUuid || inFlight.has(jobUuid) || !options.isLocalOwner(ref, agent)) return;
    inFlight.add(jobUuid);
    void Promise.resolve().then(() => {
      if (canWork() && isFresh()) return options.execute(ref, agent);
    }).catch((error: unknown) => {
      if (!stopped) options.onExecutionError(ref, error);
    }).finally(() => { inFlight.delete(jobUuid); });
  }

  function poll(): Promise<void> {
    if (!canWork()) return Promise.resolve();
    if (pendingPoll && !pendingPoll.read.isFresh()) {
      pendingPoll.read.abort();
      pendingPoll = null;
    }
    if (pendingPoll) return pendingPoll.request;
    const read = boundedRead(async (signal) => {
      const agent = await localOwner();
      if (!agent || !canWork() || !read.isFresh()) return;
      const refs = await options.fetchPending(agent, signal);
      if (!canWork() || !read.isFresh()) return;
      for (const ref of refs) dispatch(ref, agent, read.isFresh);
    }, POLL_READ_TIMEOUT_MS);
    const request = read.promise.catch((error: unknown) => {
      if (!stopped) options.onPollError(error);
    }).finally(() => {
      if (pendingPoll?.read === read) pendingPoll = null;
    });
    pendingPoll = { read, request };
    return request;
  }

  async function receive(ref: PendingPrintJobRef): Promise<void> {
    if (!canWork()) return;
    const startedAt = Date.now();
    const isFresh = () => {
      const age = Date.now() - startedAt;
      return age >= 0 && age < OWNER_READ_TIMEOUT_MS;
    };
    try {
      const agent = await localOwner();
      if (agent) dispatch(ref, agent, isFresh);
    } catch (error) {
      if (!stopped) options.onExecutionError(ref, error);
    }
  }

  const interval = globalThis.setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
  void poll();

  return {
    poll,
    receive,
    stop() {
      stopped = true;
      globalThis.clearInterval(interval);
      pendingPoll?.read.abort();
      pendingOwner?.read.abort();
      pendingPoll = null;
      pendingOwner = null;
      owner = null;
      inFlight.clear();
    },
  };
}
