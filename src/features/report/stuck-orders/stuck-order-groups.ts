import type { StuckSyncEvent, StuckSyncOrder } from "@/services/offline-sync";

/**
 * One stuck bill, with every queue row still holding it back.
 *
 * The Agent answers with events because that is what it can retry or discard,
 * but nobody at a till thinks in events — they think "table 7 never went
 * through". Grouping by order is also what makes cancelling safe to reason
 * about: an order's rows depend on each other, so they leave together anyway.
 */
export interface StuckOrderGroup {
  /** order_uuid when the events belong to a bill, else the first event's uuid. */
  key: string;
  order: StuckSyncOrder | null;
  events: StuckSyncEvent[];
  /** Carries a PAYMENT or BILL_SPLIT: discarding needs an explicit opt-in. */
  hasFinancial: boolean;
  /** At least one row is held by a kitchen ticket that never printed. */
  waitingOnPrint: boolean;
  /** Oldest row in the group, which is how long the bill has been stuck. */
  oldestAt: number;
  /** The reason worth showing first: a real rejection beats a cascade. */
  reason: string;
}

const CASCADE_REASON = "dependency blocked or missing";

export function groupStuckEvents(events: StuckSyncEvent[]): StuckOrderGroup[] {
  const groups = new Map<string, StuckOrderGroup>();

  for (const event of events) {
    const key = event.order?.order_uuid || event.event_uuid;
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
      existing.hasFinancial = existing.hasFinancial || event.is_financial;
      existing.waitingOnPrint = existing.waitingOnPrint || event.waiting_on_print;
      existing.oldestAt = Math.min(existing.oldestAt, event.created_at);
      existing.order = existing.order || event.order;
      continue;
    }
    groups.set(key, {
      key,
      order: event.order,
      events: [event],
      hasFinancial: event.is_financial,
      waitingOnPrint: event.waiting_on_print,
      oldestAt: event.created_at,
      reason: "",
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      events: [...group.events].sort((left, right) => left.sequence_no - right.sequence_no),
      reason: primaryReason(group.events),
    }))
    .sort((left, right) => left.oldestAt - right.oldestAt);
}

/**
 * "dependency blocked or missing" is what the queue writes on everything
 * downstream of a real failure, so a group full of them says nothing about why
 * the bill is stuck. Prefer any other error, and fall back to the cascade
 * message only when that is genuinely all there is.
 */
function primaryReason(events: StuckSyncEvent[]): string {
  const errors = events.map((event) => event.last_error || "").filter(Boolean);
  return errors.find((error) => !error.startsWith(CASCADE_REASON)) || errors[0] || "";
}

/**
 * Everything cancelling one row would take with it.
 *
 * discardStuckEvents walks the same edges on the Agent side and cancels the
 * whole closure, so the screen has to walk them too — otherwise a cashier
 * cancelling a single kitchen confirm gets asked nothing about money and the
 * Agent refuses the group anyway, because a payment three rows downstream was
 * never mentioned in the dialog.
 */
export function cancelClosure(events: StuckSyncEvent[], rootUuid: string): StuckSyncEvent[] {
  const byUuid = new Map(events.map((event) => [event.event_uuid, event]));
  const closure: StuckSyncEvent[] = [];
  const seen = new Set<string>();
  const queue = [rootUuid];

  while (queue.length) {
    const current = queue.shift() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    const event = byUuid.get(current);
    if (event) closure.push(event);
    for (const candidate of events) {
      if (!seen.has(candidate.event_uuid) && candidate.dependencies.includes(current)) {
        queue.push(candidate.event_uuid);
      }
    }
  }

  return closure;
}

export function closureCarriesMoney(events: StuckSyncEvent[], rootUuid: string): boolean {
  return cancelClosure(events, rootUuid).some((event) => event.is_financial);
}

export function countStuckEvents(groups: StuckOrderGroup[]): number {
  return groups.reduce((total, group) => total + group.events.length, 0);
}

export function countFinancialGroups(groups: StuckOrderGroup[]): number {
  return groups.filter((group) => group.hasFinancial).length;
}
