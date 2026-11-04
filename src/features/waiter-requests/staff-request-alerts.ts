import type { WaiterRequest } from "@/services/waiter-requests";

interface StaffRequestSnapshot {
  staffKey: string;
  staffRequests: WaiterRequest[];
  staffLoading: boolean;
  staffError: string | null;
}

interface RequestChangedEvent {
  branch_uuid_fk?: string;
  request_uuid?: unknown;
  status?: unknown;
}

export function createStaffRequestAlertTracker(branch: string) {
  const seen = new Set<string>();
  const incoming = new Set<string>();
  let initialized = false;

  return {
    recordEvent(event: RequestChangedEvent) {
      if (
        event.branch_uuid_fk === branch &&
        typeof event.request_uuid === "string" &&
        event.status === 0
      ) {
        incoming.add(event.request_uuid);
      }
    },
    consume(snapshot: StaffRequestSnapshot): WaiterRequest[] {
      if (snapshot.staffKey !== branch) {
        // A session reset must also forget alerts when the next login uses this branch.
        seen.clear();
        incoming.clear();
        initialized = false;
        return [];
      }
      if (snapshot.staffLoading || snapshot.staffError) return [];

      const fresh = snapshot.staffRequests.filter(
        (row) => !seen.has(row.request_uuid) && (initialized || incoming.has(row.request_uuid))
      );
      for (const row of snapshot.staffRequests) {
        seen.add(row.request_uuid);
        incoming.delete(row.request_uuid);
      }
      initialized = true;
      return fresh;
    },
  };
}
