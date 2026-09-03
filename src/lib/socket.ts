"use client";

import { io, type Socket } from "socket.io-client";

const socketEvents = {
  joinBranch: "join_branch",
  tableAlert: "table_alert",
  printJobQueued: "print_job_queued",
  tableStatusChanged: "table_status_changed",
  orderQueueChanged: "order_queue_changed",
  branchVatUpdated: "branch:vat-updated",
} as const;

let socket: Socket | null = null;
let joinedBranch: string | null = null;

export interface TableAlertPayload {
  branch_uuid_fk?: string;
  table_uuid: string;
  customer_order_state?: boolean;
  [key: string]: unknown;
}

type TableAlertHandler = (payload: TableAlertPayload) => void;

export interface PrintJobQueuedPayload {
  branch_uuid_fk?: string;
  print_job_uuid: string;
  device_code?: string | null;
  agent_id?: string | null;
  print_mode?: string | null;
  source?: string | null;
  remote_shared_print?: boolean;
  [key: string]: unknown;
}

type PrintJobQueuedHandler = (payload: PrintJobQueuedPayload) => void;

export interface BranchRealtimePayload {
  branch_uuid_fk?: string;
  [key: string]: unknown;
}

type BranchRealtimeHandler = (payload: BranchRealtimePayload) => void;

export interface BranchVatUpdatedPayload {
  branch_uuid_fk?: string;
  vat_status?: number;
  vat_rate?: number;
  updated_at?: string;
  [key: string]: unknown;
}

type BranchVatUpdatedHandler = (payload: BranchVatUpdatedPayload) => void;

export interface OrderQueueChangedPayload {
  branch_uuid_fk?: string;
  order_uuids?: string[];
  order_item_uuids?: string[];
  reason?: string;
  [key: string]: unknown;
}

type OrderQueueChangedHandler = (payload: OrderQueueChangedPayload) => void;

export function isTableAlertForBranch(payload: TableAlertPayload, branchUuid: string) {
  return Boolean(payload.table_uuid) && (!payload.branch_uuid_fk || payload.branch_uuid_fk === branchUuid);
}

export function isBranchRealtimeEvent(payload: BranchRealtimePayload, branchUuid: string) {
  return !payload.branch_uuid_fk || payload.branch_uuid_fk === branchUuid;
}

function socketUrl() {
  return process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
}

function emitBranchJoin(activeSocket: Socket) {
  if (!joinedBranch) return;
  activeSocket.emit(socketEvents.joinBranch, { branch_uuid_fk: joinedBranch });
}

function createSocket() {
  const nextSocket = io(socketUrl(), {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10
  });

  nextSocket.on("connect", () => emitBranchJoin(nextSocket));
  nextSocket.on("connect_error", (error) => {
    console.warn("[socket] connect_error:", error.message);
  });

  socket = nextSocket;
  return nextSocket;
}

function getSocket(branchUuid?: string) {
  const active = socket ?? createSocket();
  if (active.disconnected) active.connect();

  if (branchUuid && joinedBranch !== branchUuid) {
    joinedBranch = branchUuid;
    if (active.connected) emitBranchJoin(active);
  }

  return active;
}

export function emitTableAlert(payload: TableAlertPayload) {
  if (typeof window === "undefined") return;
  const active = getSocket(payload.branch_uuid_fk);
  const emit = () => active.emit(socketEvents.tableAlert, payload);
  if (active.connected) emit();
  else active.once("connect", emit);
}

export function subscribeTableAlerts(branchUuid: string, handler: TableAlertHandler) {
  if (typeof window === "undefined" || !branchUuid) return () => {};
  const active = getSocket(branchUuid);
  active.on(socketEvents.tableAlert, handler);
  return () => {
    active.off(socketEvents.tableAlert, handler);
  };
}

export function subscribePrintJobs(branchUuid: string, handler: PrintJobQueuedHandler) {
  if (typeof window === "undefined" || !branchUuid) return () => {};
  const active = getSocket(branchUuid);
  active.on(socketEvents.printJobQueued, handler);
  return () => {
    active.off(socketEvents.printJobQueued, handler);
  };
}

// Fires when a table changes occupancy/status or an order is added/sent to the
// kitchen anywhere in the branch — used to keep the table grid live across
// devices (e.g. another cashier opens a table).
export function subscribeBranchTableRealtime(
  branchUuid: string,
  handler: BranchRealtimeHandler,
) {
  if (typeof window === "undefined" || !branchUuid) return () => {};
  const active = getSocket(branchUuid);
  active.on(socketEvents.tableStatusChanged, handler);
  active.on(socketEvents.orderQueueChanged, handler);
  return () => {
    active.off(socketEvents.tableStatusChanged, handler);
    active.off(socketEvents.orderQueueChanged, handler);
  };
}

// Same wire event as subscribeBranchTableRealtime, but keeps the full
// order_uuids/reason payload instead of collapsing it into "something
// changed, refetch" — needed to tell one order's own status transition
// apart from another table's, e.g. for a customer-facing status toast.
export function subscribeOrderQueueChanged(branchUuid: string, handler: OrderQueueChangedHandler) {
  if (typeof window === "undefined" || !branchUuid) return () => {};
  const active = getSocket(branchUuid);
  active.on(socketEvents.orderQueueChanged, handler);
  return () => {
    active.off(socketEvents.orderQueueChanged, handler);
  };
}

// VAT config ของสาขาถูกแก้ — socket เป็นแค่ notification layer
// ผู้ฟังต้อง refetch ยอดจาก Backend ใหม่เสมอ ห้ามคำนวณ VAT เองจาก payload
export function subscribeBranchVatUpdated(branchUuid: string, handler: BranchVatUpdatedHandler) {
  if (typeof window === "undefined" || !branchUuid) return () => {};
  const active = getSocket(branchUuid);
  active.on(socketEvents.branchVatUpdated, handler);
  return () => {
    active.off(socketEvents.branchVatUpdated, handler);
  };
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  joinedBranch = null;
}
