"use client";

import { create } from "zustand";
import * as depositService from "@/services/deposit";
import type {
  DepositCreateInput,
  DepositCreateResponse,
  DepositListStatusFilter,
  DepositPrintContext,
  DepositPrintResponse,
  DepositReceiptKind,
  DepositReprintInput,
  DepositRow,
  DepositWithdrawal,
  DepositWithdrawInput,
  DepositWithdrawResponse
} from "@/services/deposit";
import { createMutationUuid } from "@/lib/pos/mutation-identity";
import { useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { resolvePosPrinterContext } from "@/stores/pos-store/printer-context";
import {
  depositCreateFingerprint,
  depositReceiptPrintOutcome,
  depositWithdrawFingerprint,
  mergeDepositRows,
  type DepositReceiptOutcome
} from "@/stores/deposit-store-helpers";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

export interface DepositReceiptState {
  kind: DepositReceiptKind;
  requestUuid: string;
  depositUuids: string[];
  depositNos: string[];
  customerName?: string;
  customerPhone?: string;
  singleDepositUuid?: string;
  withdrawalUuid: string | null;
  deposits: DepositRow[];
  withdrawal: DepositWithdrawal | null;
  outcome: DepositReceiptOutcome;
  message: string | null;
  reasonCode?: string | null;
  printJobUuid: string | null;
  printerName: string | null;
  lang?: string;
}

type ReceiptReprintInput = Omit<DepositReprintInput, "request_uuid"> & { request_uuid?: string };
export type DepositWithdrawDraft = Omit<DepositWithdrawInput, "request_uuid"> & { request_uuid?: string };

interface DepositState {
  rows: DepositRow[];
  orderRows: DepositRow[];
  loadedOrderUuid: string | null;
  total: number;
  totalPages: number;
  detail: DepositRow | null;
  detailWithdrawals: DepositWithdrawal[];
  detailLoading: boolean;
  error: string | null;
  loading: boolean;
  orderLoading: boolean;
  orderError: string | null;
  saving: boolean;
  withdrawing: boolean;
  printing: boolean;
  reprinting: boolean;
  lastReceipt: DepositReceiptState | null;
  loadList: (params: {
    branchUuid: string;
    customerUuid?: string;
    status?: DepositListStatusFilter;
    search?: string;
    lang?: string;
  }) => Promise<DepositRow[]>;
  loadDetail: (depositUuid: string, lang?: string) => Promise<DepositRow>;
  loadOrderDeposits: (params: {
    branchUuid: string;
    orderUuid: string;
    lang?: string;
  }) => Promise<DepositRow[]>;
  create: (input: DepositCreateInput) => Promise<DepositCreateResponse>;
  withdraw: (input: DepositWithdrawDraft) => Promise<DepositWithdrawResponse>;
  reprint: (input: ReceiptReprintInput) => Promise<DepositReceiptState>;
  reprintReceipt: () => Promise<DepositReceiptState>;
  clearReceipt: () => void;
  clearDetail: () => void;
  reset: () => void;
}

const initialState = {
  rows: [] as DepositRow[],
  orderRows: [] as DepositRow[],
  loadedOrderUuid: null as string | null,
  total: 0,
  totalPages: 1,
  detail: null as DepositRow | null,
  detailWithdrawals: [] as DepositWithdrawal[],
  detailLoading: false,
  error: null as string | null,
  loading: false,
  orderLoading: false,
  orderError: null as string | null,
  saving: false,
  withdrawing: false,
  printing: false,
  reprinting: false,
  lastReceipt: null as DepositReceiptState | null
};

let listRequestId = 0;
let detailRequestId = 0;
let orderRequestId = 0;
let listScope: { branchUuid: string; customerUuid?: string; status?: DepositListStatusFilter; search?: string } | null = null;
const createAttempts = new Map<string, string>();
const withdrawAttempts = new Map<string, string>();
const reprintAttempts = new Map<string, string>();
let createInFlight: { key: string; promise: Promise<DepositCreateResponse> } | null = null;
let withdrawInFlight: { key: string; promise: Promise<DepositWithdrawResponse> } | null = null;
let reprintInFlight: Promise<DepositReceiptState> | null = null;
let lastReceiptExecution: { response: DepositPrintResponse; context: DepositPrintContext } | null = null;

async function receiptContext(input: DepositPrintContext & { lang?: string }) {
  const loginUuid = useAuthStore.getState().user?.uuid;
  if (!loginUuid) return { context: {} as DepositPrintContext, error: null };
  try {
    const context = await resolvePosPrinterContext({ login_uuid_fk: loginUuid, ...input });
    return { context, error: null };
  } catch (error) {
    // The server records the deposit independently; an unavailable printer is
    // shown on its committed receipt, never as an invitation to deposit again.
    return { context: {} as DepositPrintContext, error: errorMessage(error) };
  }
}

async function deliverReceipt(
  response: DepositPrintResponse,
  receipt: DepositReceiptState,
  context: DepositPrintContext,
  contextError: string | null,
): Promise<DepositReceiptState> {
  const current = {
    ...receipt,
    printJobUuid: response.pending_query?.print_job_uuid || response.print_job?.print_job_uuid || null,
    printerName: response.print?.printer?.printer_name || null,
    reasonCode: response.print?.reason_code || null,
  };
  if (response.print_status === "success") return { ...current, outcome: "success", message: null };
  if (!current.printJobUuid || response.print_status === "failed" || response.print_status === "skipped") {
    return {
      ...current,
      outcome: response.print_status === "failed" ? "error" : "skipped",
      message: response.print?.reason || contextError || null,
    };
  }
  try {
    const result = await usePrinterStore.getState().executeReport({
      ...(response.print_job ? { print_job: response.print_job } : {}),
      ...(response.pending_query ? { pending_query: response.pending_query } : {}),
      login_uuid_fk: response.pending_query?.login_uuid_fk || useAuthStore.getState().user?.uuid,
      ...context,
    });
    return { ...current, outcome: depositReceiptPrintOutcome(result), message: result.errorMessage || null };
  } catch (error) {
    return { ...current, outcome: "error", message: errorMessage(error) };
  }
}

async function allDepositPages(params: Parameters<typeof depositService.fetchDepositList>[0]) {
  const first = await depositService.fetchDepositList(params);
  let rows = first.data;
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await depositService.fetchDepositList({ ...params, page });
    if (!next.data.length) break;
    rows = mergeDepositRows(next.data, rows);
  }
  return { ...first, data: rows };
}

export const useDepositStore = create<DepositState>((set, get) => ({
  ...initialState,
  loadList: async ({ branchUuid, customerUuid, status, search, lang }) => {
    const requestId = ++listRequestId;
    const isCurrentSession = createSessionGuard();
    listScope = { branchUuid, customerUuid, status, search };
    set({ rows: [], total: 0, totalPages: 1, error: null, loading: true });
    try {
      const response = await allDepositPages({
        branch_uuid: branchUuid,
        customer_uuid: customerUuid,
        status,
        search,
        limit: 100,
        lang
      });
      if (isCurrentSession() && requestId === listRequestId) {
        set({
          rows: response.data,
          total: response.total,
          totalPages: response.totalPages,
          loading: false
        });
      }
      return response.data;
    } catch (error) {
      if (isCurrentSession() && requestId === listRequestId) {
        set({ error: errorMessage(error), loading: false });
      }
      throw error;
    }
  },
  loadDetail: async (depositUuid, lang) => {
    const requestId = ++detailRequestId;
    const isCurrentSession = createSessionGuard();
    set({ detail: null, detailWithdrawals: [], detailLoading: true, error: null });
    try {
      const response = await depositService.fetchDepositDetail(depositUuid, lang);
      if (isCurrentSession() && requestId === detailRequestId) {
        set({
          detail: response.deposit,
          detailWithdrawals: response.withdrawals,
          detailLoading: false
        });
      }
      return response.deposit;
    } catch (error) {
      if (isCurrentSession() && requestId === detailRequestId) {
        set({ detailLoading: false, error: errorMessage(error) });
      }
      throw error;
    }
  },
  loadOrderDeposits: async ({ branchUuid, orderUuid, lang }) => {
    const requestId = ++orderRequestId;
    const isCurrentSession = createSessionGuard();
    set({
      orderRows: get().loadedOrderUuid === orderUuid ? get().orderRows : [],
      loadedOrderUuid: orderUuid,
      orderError: null,
      orderLoading: true
    });
    try {
      const response = await allDepositPages({
        branch_uuid: branchUuid,
        order_uuid: orderUuid,
        status: "all",
        limit: 100,
        lang
      });
      if (isCurrentSession() && requestId === orderRequestId) {
        set({ orderRows: response.data, orderLoading: false });
      }
      return response.data;
    } catch (error) {
      if (isCurrentSession() && requestId === orderRequestId) {
        set({ orderError: errorMessage(error), orderLoading: false });
      }
      throw error;
    }
  },
  create: async (input) => {
    const key = depositCreateFingerprint(input);
    if (createInFlight) {
      if (createInFlight.key === key) return createInFlight.promise;
      throw new Error("Another deposit is still being saved");
    }
    if (get().withdrawing || get().reprinting) throw new Error("A deposit operation is still in progress");
    const requestUuid = createAttempts.get(key) || input.request_uuid || createMutationUuid();
    createAttempts.set(key, requestUuid);
    const isCurrentSession = createSessionGuard();
    const listVersion = listRequestId;
    lastReceiptExecution = null;
    set({ error: null, saving: true, lastReceipt: null });
    const promise = (async () => {
      const { context, error: contextError } = await receiptContext(input);
      if (!isCurrentSession()) throw new Error("Session changed before the deposit was saved");
      const response = await depositService.createDeposit({
        ...input, device_code: context.device_code, agent_id: context.agent_id,
        print_mode: context.print_mode, request_uuid: requestUuid,
      });
      if (createAttempts.get(key) === requestUuid) createAttempts.delete(key);
      if (isCurrentSession()) {
        const receipt: DepositReceiptState = {
          kind: "deposit", requestUuid: response.request_uuid,
          depositUuids: response.deposits.map((row) => row.deposit_uuid),
          depositNos: response.deposits.map((row) => row.deposit_no).filter(Boolean),
          customerName: response.deposits[0]?.customer_name,
          customerPhone: response.deposits[0]?.customer_phone,
          withdrawalUuid: null, deposits: response.deposits, withdrawal: null,
          outcome: "pending", message: null, printJobUuid: null, printerName: null, lang: input.lang,
        };
        const matchesList = listVersion === listRequestId && (!listScope || (
          listScope.branchUuid === input.branch_uuid &&
          (!listScope.customerUuid || listScope.customerUuid === input.customer_uuid) &&
          (!listScope.status || ["all", "active"].includes(listScope.status)) && !listScope.search?.trim()
        ));
        const matchesOrder = Boolean(input.order_uuid) && (!get().loadedOrderUuid || get().loadedOrderUuid === input.order_uuid);
        if (matchesOrder) orderRequestId += 1;
        set({
          rows: matchesList ? mergeDepositRows(get().rows, response.deposits) : get().rows,
          orderRows: matchesOrder ? mergeDepositRows(get().orderRows, response.deposits) : get().orderRows,
          ...(matchesOrder ? { orderLoading: false, orderError: null } : {}),
          printing: true, lastReceipt: receipt,
        });
        lastReceiptExecution = { response, context };
        const result = await deliverReceipt(response, receipt, context, contextError);
        if (isCurrentSession()) set({ lastReceipt: result, printing: false });
      }
      return response;
    })();
    createInFlight = { key, promise };
    try {
      return await promise;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error) });
      throw error;
    } finally {
      if (createInFlight?.promise === promise) createInFlight = null;
      if (isCurrentSession()) set({ saving: false, printing: false });
    }
  },
  withdraw: async (input) => {
    const key = depositWithdrawFingerprint(input);
    if (withdrawInFlight) {
      if (withdrawInFlight.key === key) return withdrawInFlight.promise;
      throw new Error("Another withdrawal is still being saved");
    }
    if (get().saving || get().reprinting) throw new Error("A deposit operation is still in progress");
    const requestUuid = withdrawAttempts.get(key) || input.request_uuid || createMutationUuid();
    withdrawAttempts.set(key, requestUuid);
    const isCurrentSession = createSessionGuard();
    const detailVersion = detailRequestId;
    lastReceiptExecution = null;
    set({ error: null, withdrawing: true, lastReceipt: null });
    const promise = (async () => {
      const { context, error: contextError } = await receiptContext(input);
      if (!isCurrentSession()) throw new Error("Session changed before the withdrawal was saved");
      const response = await depositService.withdrawDeposit({
        ...input, device_code: context.device_code, agent_id: context.agent_id,
        print_mode: context.print_mode, request_uuid: requestUuid,
      });
      if (withdrawAttempts.get(key) === requestUuid) withdrawAttempts.delete(key);
      if (isCurrentSession()) {
        const receipt: DepositReceiptState = {
          kind: "withdrawal", requestUuid: response.request_uuid || requestUuid,
          depositUuids: [response.deposit.deposit_uuid], withdrawalUuid: response.withdrawal.withdrawal_uuid,
          depositNos: [response.deposit.deposit_no].filter(Boolean),
          customerName: response.deposit.customer_name, customerPhone: response.deposit.customer_phone,
          deposits: [response.deposit], withdrawal: response.withdrawal,
          outcome: "pending", message: null, printJobUuid: null, printerName: null, lang: input.lang,
        };
        const sameDetail = get().detail?.deposit_uuid === response.deposit.deposit_uuid;
        const updateDetail = detailVersion === detailRequestId && (sameDetail || get().detail === null);
        if (updateDetail) detailRequestId += 1;
        const updateOrder = get().orderRows.some((row) => row.deposit_uuid === response.deposit.deposit_uuid);
        if (updateOrder) orderRequestId += 1;
        set({
          rows: get().rows.map((row) => row.deposit_uuid === response.deposit.deposit_uuid ? response.deposit : row),
          orderRows: get().orderRows.map((row) => row.deposit_uuid === response.deposit.deposit_uuid ? response.deposit : row),
          ...(updateDetail ? {
            detail: response.deposit, detailLoading: false,
            detailWithdrawals: [
              ...(sameDetail ? get().detailWithdrawals : []).filter((row) => row.withdrawal_uuid !== response.withdrawal.withdrawal_uuid),
              response.withdrawal,
            ],
          } : {}),
          ...(updateOrder ? { orderLoading: false, orderError: null } : {}),
          printing: true, lastReceipt: receipt,
        });
        lastReceiptExecution = { response, context };
        const result = await deliverReceipt(response, receipt, context, contextError);
        if (isCurrentSession()) set({ lastReceipt: result, printing: false });
      }
      return response;
    })();
    withdrawInFlight = { key, promise };
    try {
      return await promise;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error) });
      throw error;
    } finally {
      if (withdrawInFlight?.promise === promise) withdrawInFlight = null;
      if (isCurrentSession()) set({ withdrawing: false, printing: false });
    }
  },
  reprint: async (input) => {
    if (reprintInFlight) return reprintInFlight;
    if (get().saving || get().withdrawing) throw new Error("A deposit operation is still in progress");
    const key = JSON.stringify([input.kind, input.deposit_request_uuid, input.deposit_uuid, input.withdrawal_uuid]);
    const requestUuid = reprintAttempts.get(key) || input.request_uuid || createMutationUuid();
    reprintAttempts.set(key, requestUuid);
    const isCurrentSession = createSessionGuard();
    const existing = get().lastReceipt;
    const matching = existing && existing.kind === input.kind && (
      input.kind === "withdrawal" ? existing.withdrawalUuid === input.withdrawal_uuid :
        existing.requestUuid === input.deposit_request_uuid || existing.depositUuids.includes(input.deposit_uuid || "")
    );
    const row = get().rows.find((deposit) => deposit.deposit_uuid === input.deposit_uuid);
    const receipt: DepositReceiptState = matching ? { ...existing } : {
      kind: input.kind, requestUuid: input.deposit_request_uuid || input.deposit_uuid || input.withdrawal_uuid || "",
      depositUuids: input.deposit_uuid ? [input.deposit_uuid] : [], withdrawalUuid: input.withdrawal_uuid || null,
      depositNos: row?.deposit_no ? [row.deposit_no] : [],
      customerName: row?.customer_name, customerPhone: row?.customer_phone,
      singleDepositUuid: input.deposit_uuid,
      deposits: row ? [row] : [], withdrawal: null,
      outcome: "pending", message: null, printJobUuid: null, printerName: null, lang: input.lang,
    };
    set({ reprinting: true, printing: true, lastReceipt: { ...receipt, outcome: "pending", message: null } });
    const promise = (async () => {
      try {
        const { context, error: contextError } = await receiptContext(input);
        if (!isCurrentSession()) throw new Error("Session changed before the receipt was requested");
        const response = await depositService.reprintDepositReceipt({
          ...input, device_code: context.device_code, agent_id: context.agent_id,
          print_mode: context.print_mode, request_uuid: requestUuid,
        });
        if (reprintAttempts.get(key) === requestUuid) reprintAttempts.delete(key);
        const deposits = response.deposits || (response.deposit ? [response.deposit] : receipt.deposits);
        const committedReceipt = {
          ...receipt, deposits, requestUuid: response.request_uuid || receipt.requestUuid,
          depositUuids: deposits.length ? deposits.map((deposit) => deposit.deposit_uuid) : receipt.depositUuids,
          depositNos: deposits.length ? deposits.map((deposit) => deposit.deposit_no).filter(Boolean) : receipt.depositNos,
          customerName: deposits[0]?.customer_name || receipt.customerName,
          customerPhone: deposits[0]?.customer_phone || receipt.customerPhone,
          withdrawal: response.withdrawal || receipt.withdrawal,
        };
        if (isCurrentSession()) lastReceiptExecution = { response, context };
        const result = isCurrentSession()
          ? await deliverReceipt(response, committedReceipt, context, contextError)
          : committedReceipt;
        if (isCurrentSession()) set({ lastReceipt: result });
        return result;
      } catch (error) {
        const result = { ...receipt, outcome: "error" as const, message: errorMessage(error) };
        if (isCurrentSession()) set({ lastReceipt: result });
        return result;
      } finally {
        if (isCurrentSession()) set({ reprinting: false, printing: false });
      }
    })();
    reprintInFlight = promise;
    try { return await promise; }
    finally { if (reprintInFlight === promise) reprintInFlight = null; }
  },
  reprintReceipt: async () => {
    const receipt = get().lastReceipt;
    if (!receipt) throw new Error("No saved deposit receipt is available");
    if (receipt.outcome === "pending" && lastReceiptExecution) {
      // Observe the existing round while its owner is still printing. A new
      // physical copy is permitted only after that pending result is resolved.
      if (reprintInFlight) return reprintInFlight;
      const execution = lastReceiptExecution;
      const isCurrentSession = createSessionGuard();
      set({ reprinting: true, printing: true });
      const promise = deliverReceipt(execution.response, receipt, execution.context, null);
      reprintInFlight = promise;
      try {
        const result = await promise;
        if (isCurrentSession()) set({ lastReceipt: result });
        return result;
      } finally {
        if (reprintInFlight === promise) reprintInFlight = null;
        if (isCurrentSession()) set({ reprinting: false, printing: false });
      }
    }
    return get().reprint({
      kind: receipt.kind,
      ...(receipt.kind === "withdrawal"
        ? { withdrawal_uuid: receipt.withdrawalUuid || undefined }
        : receipt.singleDepositUuid ? { deposit_uuid: receipt.singleDepositUuid }
          : { deposit_request_uuid: receipt.requestUuid }),
      lang: receipt.lang,
    });
  },
  clearReceipt: () => {
    if (!get().printing) {
      lastReceiptExecution = null;
      set({ lastReceipt: null });
    }
  },
  clearDetail: () => {
    detailRequestId += 1;
    set({ detail: null, detailWithdrawals: [], detailLoading: false });
  },
  reset: () => {
    listRequestId += 1;
    detailRequestId += 1;
    orderRequestId += 1;
    listScope = null;
    createAttempts.clear();
    withdrawAttempts.clear();
    reprintAttempts.clear();
    createInFlight = null;
    withdrawInFlight = null;
    reprintInFlight = null;
    lastReceiptExecution = null;
    set(initialState);
  }
}));

registerSessionStoreReset("deposit", () => useDepositStore.getState().reset());
