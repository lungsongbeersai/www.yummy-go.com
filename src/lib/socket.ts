"use client";

import { io, type Socket } from "socket.io-client";

const socketEvents = {
  joinBranch: "join_branch",
  tableAlert: "table_alert"
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

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  joinedBranch = null;
}
