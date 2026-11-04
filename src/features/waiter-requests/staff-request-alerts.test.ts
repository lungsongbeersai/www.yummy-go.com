import { describe, expect, it } from "vitest";
import type { WaiterRequest } from "@/services/waiter-requests";
import { createStaffRequestAlertTracker } from "./staff-request-alerts";

const existing: WaiterRequest = {
  request_uuid: "existing",
  table_uuid: "table",
  branch_uuid: "branch",
  items: [{ kind: "staff", qty: 1 }],
  message: "Help please",
  status: 0,
  created_at: "2026-11-04T10:00:00Z",
};
const incoming = { ...existing, request_uuid: "incoming" };

function snapshot(staffRequests: WaiterRequest[]) {
  return { staffKey: "branch", staffRequests, staffLoading: false, staffError: null };
}

describe("staff request alerts", () => {
  it("suppresses existing calls then alerts the very next new request", () => {
    const tracker = createStaffRequestAlertTracker("branch");
    expect(tracker.consume(snapshot([existing]))).toEqual([]);
    expect(tracker.consume(snapshot([incoming, existing]))).toEqual([incoming]);
  });

  it("alerts a real call received during initial loading without replaying backlog", () => {
    const tracker = createStaffRequestAlertTracker("branch");
    tracker.consume({ ...snapshot([]), staffLoading: true });
    tracker.recordEvent({ branch_uuid_fk: "branch", request_uuid: "incoming", status: 0 });
    expect(tracker.consume(snapshot([incoming, existing]))).toEqual([incoming]);
  });

  it("keeps seen calls across reconnects, status changes and temporary removals", () => {
    const tracker = createStaffRequestAlertTracker("branch");
    tracker.consume(snapshot([existing]));
    expect(tracker.consume(snapshot([incoming, existing]))).toEqual([incoming]);
    tracker.recordEvent({ branch_uuid_fk: "branch", request_uuid: "incoming", status: 0 });
    expect(tracker.consume(snapshot([{ ...incoming, status: 1 }, existing]))).toEqual([]);
    tracker.consume(snapshot([]));
    expect(tracker.consume(snapshot([incoming]))).toEqual([]);
  });

  it("does not lose fresh calls when refreshes fail or an earlier refresh is still loading", () => {
    const tracker = createStaffRequestAlertTracker("branch");
    tracker.consume(snapshot([existing]));
    expect(tracker.consume({ ...snapshot([incoming]), staffLoading: true })).toEqual([]);
    expect(tracker.consume({ ...snapshot([incoming]), staffError: "Unavailable" })).toEqual([]);
    expect(tracker.consume(snapshot([incoming, existing]))).toEqual([incoming]);
  });

  it("ignores other branch events, reconnect-only events and acceptance updates during baseline", () => {
    const tracker = createStaffRequestAlertTracker("branch");
    tracker.recordEvent({ branch_uuid_fk: "other", request_uuid: "incoming", status: 0 });
    tracker.recordEvent({ branch_uuid_fk: "branch" });
    tracker.recordEvent({ branch_uuid_fk: "branch", request_uuid: "incoming", status: 1 });
    expect(tracker.consume(snapshot([incoming, existing]))).toEqual([]);
  });

  it("resets its baseline with session data so the next login does not replay existing calls", () => {
    const tracker = createStaffRequestAlertTracker("branch");
    tracker.consume(snapshot([existing]));
    tracker.consume({ ...snapshot([]), staffKey: "" });
    expect(tracker.consume(snapshot([incoming, existing]))).toEqual([]);
    const next = { ...incoming, request_uuid: "next" };
    expect(tracker.consume(snapshot([next, incoming, existing]))).toEqual([next]);
  });
});
