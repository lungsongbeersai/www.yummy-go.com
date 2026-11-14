"use client";

import { create } from "zustand";
import { ServiceError } from "@/lib/api";
import { employeeWorkBoundaryDelay, employeeWorkClock, employeeWorkPeriod } from "@/features/pos/employee-work/employee-work-period";
import { getEmployeeWork, getEmployeeWorkReport, type EmployeeWorkParams, type EmployeeWorkResponse } from "@/services/pos";
import { useAuthStore } from "@/stores/auth-store";
import { employeeWorkIdentity, employeeWorkQueryKey, requireEmployeeWorkScope } from "@/stores/employee-work-helpers";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface EmployeeWorkClockSample { serverNow: string; receivedAtMs: number }

interface EmployeeWorkState {
  sessionVersion: number;
  response: EmployeeWorkResponse | null;
  report: EmployeeWorkResponse | null;
  params: EmployeeWorkParams;
  clock: EmployeeWorkClockSample | null;
  loading: boolean;
  error: string | null;
  reportLoading: boolean;
  reportError: string | null;
  rollover: boolean;
  enter: () => number;
  leave: (lease: number) => void;
  load: (params?: EmployeeWorkParams) => Promise<void>;
  loadReport: () => Promise<EmployeeWorkResponse | null>;
  isCurrentReport: (report: EmployeeWorkResponse) => boolean;
  boundaryDelay: () => number | null;
  checkRollover: () => boolean;
  reset: () => void;
}

const initialParams: EmployeeWorkParams = { scope: "current", kitchen_status: "all", payment_status: "all", search: "", page: 1, limit: 20 };
const initialState = { response: null, report: null, params: initialParams, clock: null, loading: false, error: null, reportLoading: false, reportError: null, rollover: false };
let generation = 0;
let leaseSequence = 0;
let activeLease = 0;
let listRequest = 0;
let reportRequest = 0;

// Use the same monotonic clock for receipt samples, elapsed time and cutoff timers.
function clockNow() { return performance.now(); }

export const useEmployeeWorkStore = create<EmployeeWorkState>((set, get) => {
  function clear(announce: boolean) {
    generation += 1; activeLease = 0; listRequest += 1; reportRequest += 1;
    set({ ...initialState, ...(announce ? { sessionVersion: get().sessionVersion + 1 } : {}) });
  }
  function guard() {
    const version = generation;
    const lease = activeLease;
    const auth = useAuthStore.getState();
    const identity = employeeWorkIdentity(auth.user, auth.token);
    const session = createSessionGuard();
    return () => Boolean(lease) && lease === activeLease && version === generation && session() && identity === employeeWorkIdentity(useAuthStore.getState().user, useAuthStore.getState().token);
  }

  function requireCurrentDay(response: EmployeeWorkResponse) {
    const period = employeeWorkPeriod(employeeWorkClock(response.server_now, 0, 0));
    employeeWorkBoundaryDelay(response.business_day.next_reset_at, response.server_now, 0, 0);
    const serverDay = period.businessDay;
    const sample = get().clock;
    const sampledDay = sample ? employeeWorkPeriod(employeeWorkClock(sample.serverNow, sample.receivedAtMs, clockNow())).businessDay : serverDay;
    if (response.business_day.date !== serverDay || response.business_day.date < sampledDay) throw new ServiceError("The business day changed. Please refresh your work", 409);
    if (Date.parse(response.business_day.starts_at) !== Date.parse(period.startsAt) || Date.parse(response.business_day.ends_at) !== Date.parse(period.endsAt) || Date.parse(response.business_day.next_reset_at) !== Date.parse(period.nextBoundaryAt)) throw new ServiceError("The work period could not be verified", 409);
  }

  return {
    ...initialState,
    sessionVersion: 0,
    enter: () => { generation += 1; activeLease = ++leaseSequence; listRequest += 1; reportRequest += 1; set(initialState); return activeLease; },
    leave: lease => { if (lease === activeLease) clear(false); },
    reset: () => clear(true),
    load: async (changes = {}) => {
      const params = { ...get().params, ...changes, business_date: undefined };
      const key = employeeWorkQueryKey(params);
      const current = guard();
      if (!current()) return;
      const request = ++listRequest;
      const changed = key !== employeeWorkQueryKey(get().params);
      if (changed) reportRequest += 1;
      set({ params, loading: true, error: null, ...(changed ? { response: null, report: null, reportLoading: false, reportError: null } : {}) });
      try {
        const response = await getEmployeeWork(params);
        if (!current() || request !== listRequest) return;
        requireEmployeeWorkScope(response, useAuthStore.getState().user, params);
        requireCurrentDay(response);
        const previousClock = get().clock;
        const dayChanged = previousClock && employeeWorkPeriod(employeeWorkClock(previousClock.serverNow, 0, 0)).businessDay !== response.business_day.date;
        if (dayChanged) {
          generation += 1;
          reportRequest += 1;
          set({ report: null, reportLoading: false, reportError: null });
          if ((params.page ?? 1) !== 1) {
            set({ response: null, loading: false, rollover: true, params: { ...params, page: 1 }, clock: { serverNow: response.server_now, receivedAtMs: clockNow() } });
            await get().load({ page: 1 });
            return;
          }
        }
        set({ response, clock: { serverNow: response.server_now, receivedAtMs: clockNow() }, loading: false, rollover: false });
      } catch (error) {
        if (current() && request === listRequest) set({ response: null, report: null, loading: false, error: errorMessage(error), rollover: false });
        throw error;
      }
    },
    loadReport: async () => {
      if (get().reportLoading || get().checkRollover()) return null;
      const snapshot = get().response;
      if (!snapshot || get().loading || get().error) return null;
      const current = guard();
      const params = { ...get().params, business_date: snapshot.business_day.date };
      const key = employeeWorkQueryKey(params);
      const request = ++reportRequest;
      set({ report: null, reportLoading: true, reportError: null });
      try {
        const response = await getEmployeeWorkReport(params);
        if (!current() || request !== reportRequest || key !== employeeWorkQueryKey(get().params)) return null;
        requireEmployeeWorkScope(response, useAuthStore.getState().user, params, true);
        requireCurrentDay(response);
        if (response.business_day.date !== snapshot.business_day.date) throw new ServiceError("The business day changed. Please refresh your work", 409);
        set({ report: response, reportLoading: false });
        return response;
      } catch (error) {
        if (!current() || request !== reportRequest) return null;
        set({ report: null, reportLoading: false, reportError: errorMessage(error) });
        throw error;
      }
    },
    isCurrentReport: report => {
      if (get().report !== report || !activeLease) return false;
      try { requireEmployeeWorkScope(report, useAuthStore.getState().user, get().params, true); requireCurrentDay(report); return true; } catch { return false; }
    },
    boundaryDelay: () => {
      const { clock, response } = get();
      return clock && response ? employeeWorkBoundaryDelay(response.business_day.next_reset_at, clock.serverNow, clock.receivedAtMs, clockNow()) : null;
    },
    checkRollover: () => {
      const { clock, response, params } = get();
      if (!clock || !response || employeeWorkClock(clock.serverNow, clock.receivedAtMs, clockNow()).getTime() < new Date(response.business_day.next_reset_at).getTime()) return false;
      generation += 1; listRequest += 1; reportRequest += 1;
      set({ response: null, report: null, loading: false, reportLoading: false, reportError: null, error: null, rollover: true, params: { ...params, page: 1 } });
      void get().load().catch(() => {});
      return true;
    },
  };
});

registerSessionStoreReset("employee-work", () => useEmployeeWorkStore.getState().reset());
useAuthStore.subscribe((current, previous) => {
  if (employeeWorkIdentity(current.user, current.token) !== employeeWorkIdentity(previous.user, previous.token)) useEmployeeWorkStore.getState().reset();
});
