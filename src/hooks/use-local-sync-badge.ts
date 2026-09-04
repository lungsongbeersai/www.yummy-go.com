"use client";

import { useEffect, useState } from "react";
import { getLocalSyncStatus } from "@/services/offline-sync";

// What the cashier standing at the till needs to know: whether the sale they
// just took has reached the server. A bill can read seven items on the POS and
// two in the back office for a whole day, because everything on this screen
// comes from the local queue and nothing on it says the queue is stuck.
//
// Same source as the sync review page (`GET /local/sync/status`), no new
// endpoint and no new polling loop of its own beyond this one interval.

export type LocalSyncBadgeTone = "blocked" | "print" | "failed" | "pending";

export interface LocalSyncBadgeState {
  tone: LocalSyncBadgeTone;
  count: number;
}

const POLL_INTERVAL_MS = 5000;

/** Only the states a cashier can act on; PROCESSING is in flight and settles itself. */
export function localSyncBadgeState(pending: {
  pending?: number;
  failed?: number;
  blocked?: number;
  waiting_on_print?: number;
} | undefined): LocalSyncBadgeState | null {
  const blocked = Number(pending?.blocked || 0);
  // Blocked first: it will never clear on its own and needs a manager.
  if (blocked > 0) return { tone: "blocked", count: blocked };
  // Then a kitchen confirmation whose ticket failed to print. It reports itself
  // as pending, but proof of print is required before it may sync and a failed
  // ticket never retries on its own — so it waits forever unless someone fixes
  // the printer. Saying "syncing" would be a lie.
  const waitingOnPrint = Number(pending?.waiting_on_print || 0);
  if (waitingOnPrint > 0) return { tone: "print", count: waitingOnPrint };
  const failed = Number(pending?.failed || 0);
  if (failed > 0) return { tone: "failed", count: failed };
  const waiting = Number(pending?.pending || 0);
  if (waiting > 0) return { tone: "pending", count: waiting };
  return null;
}

/**
 * Null while everything has reached the server, which is the normal case — the
 * badge only appears when there is something to say.
 */
export function useLocalSyncBadge(): LocalSyncBadgeState | null {
  const [state, setState] = useState<LocalSyncBadgeState | null>(null);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const check = async () => {
      // maxAgeMs lets this share the status the transport monitor already
      // fetched instead of adding a second request on the same interval.
      const status = await getLocalSyncStatus({ maxAgeMs: POLL_INTERVAL_MS })
        .catch(() => null);
      if (!active) return;
      setState(localSyncBadgeState(status?.pending));
      timer = window.setTimeout(() => void check(), POLL_INTERVAL_MS);
    };

    void check();
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return state;
}
