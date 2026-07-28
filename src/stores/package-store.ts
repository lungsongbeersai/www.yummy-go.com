"use client";

import { create } from "zustand";
import { ServiceError } from "@/lib/api";
import {
  createPackagePlan as createPackagePlanRequest,
  fetchBillingCycles,
  fetchPackageMethods,
  fetchPackagePage,
  fetchPackagePlanGroups,
  reorderBillingCycles,
  reorderPackageDetails,
  reorderPackagePlans,
  savePackage as savePackageRequest,
  type BillingCycle,
  type CreatePackagePlanInput,
  type PackageBillingGroup,
  type PackageDetail,
  type PackageMethod,
  type PackagePlan,
  type PackagePlanGroup,
  type SavePackageInput,
} from "@/services/package";
import {
  replacePackageDetailOrder,
  replacePlanGroupOrder,
  withCycleOrder,
} from "@/stores/package-store-helpers";
import {
  createSessionGuard,
  registerSessionStoreReset,
} from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

export interface PackageQuery {
  language?: string;
  status?: "all" | 1 | 2;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: "asc" | "desc";
}

export interface PackageLoadOptions {
  background?: boolean;
}

export type PackageSortingScope =
  | "cycles"
  | `plans:${string}`
  | `details:${string}`
  | null;

export interface PackageState {
  billingCycles: BillingCycle[];
  methods: PackageMethod[];
  planGroups: PackagePlanGroup[];
  packageGroups: PackageBillingGroup[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasLoaded: boolean;
  catalogReady: boolean;
  loading: boolean;
  refreshing: boolean;
  saving: boolean;
  sortingScope: PackageSortingScope;
  error: string | null;
  loadError: string | null;
  loadCatalog: (
    query: PackageQuery,
    options?: PackageLoadOptions
  ) => Promise<void>;
  loadPackages: (
    query: PackageQuery,
    options?: PackageLoadOptions
  ) => Promise<void>;
  createPlan: (
    input: CreatePackagePlanInput,
    query: PackageQuery
  ) => Promise<void>;
  save: (input: SavePackageInput, query: PackageQuery) => Promise<void>;
  sortCycles: (cycles: BillingCycle[], query: PackageQuery) => Promise<void>;
  sortPlans: (
    cycleId: string,
    plans: PackagePlan[],
    query: PackageQuery
  ) => Promise<void>;
  sortDetails: (
    packageId: string,
    details: PackageDetail[],
    query: PackageQuery
  ) => Promise<void>;
  reset: () => void;
}

type LoadOperationKind = "foreground" | "background";

interface FulfilledRequest<T> {
  status: "fulfilled";
  value: T;
}

interface RejectedRequest {
  status: "rejected";
  reason: unknown;
}

type RequestOutcome<T> = FulfilledRequest<T> | RejectedRequest;

let catalogLoadRequestId = 0;
let packageLoadRequestId = 0;
let loadStateRequestId = 0;
let storeGeneration = 0;
let loadOperationId = 0;
let mutationOperationId = 0;
let reorderOperationId = 0;
let activePackageQueryKey: string | null = null;
let activeReorderOperationId: number | null = null;
const activeLoadOperations = new Map<number, LoadOperationKind>();
const activeMutationOperations = new Set<number>();

function packageQueryKey(query: PackageQuery): string {
  return JSON.stringify([
    query.language ?? "",
    query.status ?? "all",
    query.search ?? "",
    query.page ?? 1,
    query.limit ?? 10,
    query.orderBy ?? "asc",
  ]);
}

async function captureRequest<T>(
  promise: Promise<T>
): Promise<RequestOutcome<T>> {
  try {
    return { status: "fulfilled", value: await promise };
  } catch (reason) {
    return { status: "rejected", reason };
  }
}

function loadBusyState(): Pick<PackageState, "loading" | "refreshing"> {
  const hasForeground = Array.from(activeLoadOperations.values()).some(
    (kind) => kind === "foreground"
  );
  const hasBackground = Array.from(activeLoadOperations.values()).some(
    (kind) => kind === "background"
  );

  return {
    loading: hasForeground,
    refreshing: !hasForeground && hasBackground,
  };
}

export const usePackageStore = create<PackageState>((set, get) => {
  const beginLoad = (background: boolean) => {
    const operationId = ++loadOperationId;
    activeLoadOperations.set(
      operationId,
      background ? "background" : "foreground"
    );
    set(loadBusyState());
    return operationId;
  };

  const finishLoad = (operationId: number) => {
    if (!activeLoadOperations.delete(operationId)) return;
    set(loadBusyState());
  };

  const beginMutation = () => {
    const operationId = ++mutationOperationId;
    activeMutationOperations.add(operationId);
    set({ saving: true, error: null });
    return operationId;
  };

  const finishMutation = (operationId: number) => {
    if (!activeMutationOperations.delete(operationId)) return;
    set({ saving: activeMutationOperations.size > 0 });
  };

  const beginReorder = () => {
    if (activeReorderOperationId !== null) {
      throw new ServiceError("A package reorder is already in progress", 409);
    }
    const operationId = ++reorderOperationId;
    activeReorderOperationId = operationId;
    return operationId;
  };

  const finishReorder = (operationId: number) => {
    if (activeReorderOperationId === operationId) {
      activeReorderOperationId = null;
    }
  };

  const refreshCatalogBestEffort = async (
    query: PackageQuery,
    isCurrentOperation: () => boolean
  ) => {
    const queryKey = packageQueryKey(query);
    if (
      !isCurrentOperation() ||
      (activePackageQueryKey !== null && activePackageQueryKey !== queryKey)
    ) {
      return;
    }

    try {
      await get().loadCatalog(query, { background: true });
    } catch {
      // The write succeeded; the catalog loader owns the refresh error state.
    }
  };

  const refreshPackagesBestEffort = async (
    query: PackageQuery,
    isCurrentOperation: () => boolean
  ) => {
    const queryKey = packageQueryKey(query);
    if (
      !isCurrentOperation() ||
      (activePackageQueryKey !== null && activePackageQueryKey !== queryKey)
    ) {
      return;
    }

    try {
      await get().loadPackages(query, { background: true });
    } catch {
      // The write succeeded; the package loader owns the refresh error state.
    }
  };

  return {
    billingCycles: [],
    methods: [],
    planGroups: [],
    packageGroups: [],
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasLoaded: false,
    catalogReady: false,
    loading: false,
    refreshing: false,
    saving: false,
    sortingScope: null,
    error: null,
    loadError: null,
    loadCatalog: async (query, options) => {
      const operationGeneration = storeGeneration;
      const catalogRequestId = ++catalogLoadRequestId;
      const packageRequestId = ++packageLoadRequestId;
      const requestId = ++loadStateRequestId;
      const isCurrentSession = createSessionGuard();
      const isCurrentOperation = () =>
        operationGeneration === storeGeneration && isCurrentSession();
      const isCurrentLoadStateRequest = () =>
        requestId === loadStateRequestId && isCurrentOperation();
      const background = Boolean(options?.background && get().catalogReady);
      const loadId = beginLoad(background);
      const queryKey = packageQueryKey(query);

      activePackageQueryKey = queryKey;
      set({ loadError: null });

      try {
        const [
          billingCyclesResult,
          methodsResult,
          planGroupsResult,
          packagePageResult,
        ] = await Promise.all([
          captureRequest(fetchBillingCycles(query.language)),
          captureRequest(fetchPackageMethods(query.language)),
          captureRequest(fetchPackagePlanGroups(query.language)),
          captureRequest(fetchPackagePage(query)),
        ]);
        const isCurrentCatalogRequest =
          catalogRequestId === catalogLoadRequestId;
        const isCurrentPackageRequest =
          packageRequestId === packageLoadRequestId &&
          activePackageQueryKey === queryKey;
        const referenceFailure =
          billingCyclesResult.status === "rejected"
            ? billingCyclesResult
            : methodsResult.status === "rejected"
            ? methodsResult
            : planGroupsResult.status === "rejected"
            ? planGroupsResult
            : null;

        if (isCurrentOperation()) {
          if (
            isCurrentCatalogRequest &&
            billingCyclesResult.status === "fulfilled" &&
            methodsResult.status === "fulfilled" &&
            planGroupsResult.status === "fulfilled"
          ) {
            set({
              billingCycles: billingCyclesResult.value,
              methods: methodsResult.value,
              planGroups: planGroupsResult.value,
            });
          }

          if (
            isCurrentPackageRequest &&
            packagePageResult.status === "fulfilled"
          ) {
            const packagePage = packagePageResult.value;
            set({
              packageGroups: packagePage.groups,
              page: packagePage.page,
              limit: packagePage.limit,
              total: packagePage.total,
              totalPages: packagePage.totalPages,
              hasLoaded: true,
            });
          }
        }

        const requestFailure =
          referenceFailure ??
          (packagePageResult.status === "rejected" ? packagePageResult : null);
        if (isCurrentLoadStateRequest()) {
          set(
            requestFailure
              ? { loadError: errorMessage(requestFailure.reason) }
              : { catalogReady: true, loadError: null }
          );
        }
        if (requestFailure) throw requestFailure.reason;
      } finally {
        finishLoad(loadId);
      }
    },
    loadPackages: async (query, options) => {
      const operationGeneration = storeGeneration;
      const packageRequestId = ++packageLoadRequestId;
      const requestId = ++loadStateRequestId;
      const isCurrentSession = createSessionGuard();
      const isCurrentOperation = () =>
        operationGeneration === storeGeneration && isCurrentSession();
      const isCurrentLoadStateRequest = () =>
        requestId === loadStateRequestId && isCurrentOperation();
      const background = Boolean(options?.background && get().catalogReady);
      const loadId = beginLoad(background);
      const queryKey = packageQueryKey(query);

      activePackageQueryKey = queryKey;
      set({ loadError: null });

      try {
        const packagePage = await fetchPackagePage(query);
        if (
          packageRequestId === packageLoadRequestId &&
          activePackageQueryKey === queryKey &&
          isCurrentOperation()
        ) {
          set({
            packageGroups: packagePage.groups,
            page: packagePage.page,
            limit: packagePage.limit,
            total: packagePage.total,
            totalPages: packagePage.totalPages,
            hasLoaded: true,
          });
        }
      } catch (error) {
        if (isCurrentLoadStateRequest()) {
          set({ loadError: errorMessage(error) });
        }
        throw error;
      } finally {
        finishLoad(loadId);
      }
    },
    createPlan: async (input, query) => {
      const operationGeneration = storeGeneration;
      const isCurrentSession = createSessionGuard();
      const isCurrentOperation = () =>
        operationGeneration === storeGeneration && isCurrentSession();
      const mutationId = beginMutation();

      try {
        await createPackagePlanRequest(input);
      } catch (error) {
        if (isCurrentOperation()) {
          set({ error: errorMessage(error) });
        }
        throw error;
      } finally {
        finishMutation(mutationId);
      }

      await refreshCatalogBestEffort(query, isCurrentOperation);
    },
    save: async (input, query) => {
      const operationGeneration = storeGeneration;
      const isCurrentSession = createSessionGuard();
      const isCurrentOperation = () =>
        operationGeneration === storeGeneration && isCurrentSession();
      const mutationId = beginMutation();

      try {
        await savePackageRequest(input);
      } catch (error) {
        if (isCurrentOperation()) {
          set({ error: errorMessage(error) });
        }
        throw error;
      } finally {
        finishMutation(mutationId);
      }

      await refreshPackagesBestEffort(query, isCurrentOperation);
    },
    sortCycles: async (cycles, query) => {
      const operationGeneration = storeGeneration;
      const isCurrentSession = createSessionGuard();
      const isCurrentOperation = () =>
        operationGeneration === storeGeneration && isCurrentSession();
      const reorderId = beginReorder();

      const previousBillingCycles = get().billingCycles;
      const orderedCycles = withCycleOrder(cycles);

      set({
        billingCycles: orderedCycles,
        sortingScope: "cycles",
        error: null,
      });

      try {
        await reorderBillingCycles(orderedCycles);
      } catch (error) {
        if (isCurrentOperation() && activeReorderOperationId === reorderId) {
          set({
            ...(get().billingCycles === orderedCycles
              ? { billingCycles: previousBillingCycles }
              : {}),
            sortingScope: null,
            error: errorMessage(error),
          });
        }
        finishReorder(reorderId);
        throw error;
      }

      await refreshCatalogBestEffort(query, isCurrentOperation);
      if (isCurrentOperation() && activeReorderOperationId === reorderId) {
        set({ sortingScope: null });
      }
      finishReorder(reorderId);
    },
    sortPlans: async (cycleId, plans, query) => {
      const operationGeneration = storeGeneration;
      const isCurrentSession = createSessionGuard();
      const isCurrentOperation = () =>
        operationGeneration === storeGeneration && isCurrentSession();
      const reorderId = beginReorder();

      const previousPlanGroups = get().planGroups;
      const orderedPlanGroups = replacePlanGroupOrder(
        previousPlanGroups,
        cycleId,
        plans
      );
      if (orderedPlanGroups === previousPlanGroups) {
        finishReorder(reorderId);
        return;
      }

      const orderedPlans =
        orderedPlanGroups.find((group) => group.billingCycleId === cycleId)
          ?.plans ?? [];

      set({
        planGroups: orderedPlanGroups,
        sortingScope: `plans:${cycleId}`,
        error: null,
      });

      try {
        await reorderPackagePlans(cycleId, orderedPlans);
      } catch (error) {
        if (isCurrentOperation() && activeReorderOperationId === reorderId) {
          set({
            ...(get().planGroups === orderedPlanGroups
              ? { planGroups: previousPlanGroups }
              : {}),
            sortingScope: null,
            error: errorMessage(error),
          });
        }
        finishReorder(reorderId);
        throw error;
      }

      await refreshCatalogBestEffort(query, isCurrentOperation);
      if (isCurrentOperation() && activeReorderOperationId === reorderId) {
        set({ sortingScope: null });
      }
      finishReorder(reorderId);
    },
    sortDetails: async (packageId, details, query) => {
      const operationGeneration = storeGeneration;
      const isCurrentSession = createSessionGuard();
      const isCurrentOperation = () =>
        operationGeneration === storeGeneration && isCurrentSession();
      const reorderId = beginReorder();

      const previousPackageGroups = get().packageGroups;
      const orderedPackageGroups = replacePackageDetailOrder(
        previousPackageGroups,
        packageId,
        details
      );
      if (orderedPackageGroups === previousPackageGroups) {
        finishReorder(reorderId);
        return;
      }

      const orderedDetails =
        orderedPackageGroups
          .flatMap((group) => group.methods)
          .flatMap((method) => method.packages)
          .find((item) => item.id === packageId)?.details ?? [];

      set({
        packageGroups: orderedPackageGroups,
        sortingScope: `details:${packageId}`,
        error: null,
      });

      try {
        await reorderPackageDetails(packageId, orderedDetails);
      } catch (error) {
        if (isCurrentOperation() && activeReorderOperationId === reorderId) {
          set({
            ...(get().packageGroups === orderedPackageGroups
              ? { packageGroups: previousPackageGroups }
              : {}),
            sortingScope: null,
            error: errorMessage(error),
          });
        }
        finishReorder(reorderId);
        throw error;
      }

      await refreshPackagesBestEffort(query, isCurrentOperation);
      if (isCurrentOperation() && activeReorderOperationId === reorderId) {
        set({ sortingScope: null });
      }
      finishReorder(reorderId);
    },
    reset: () => {
      storeGeneration += 1;
      catalogLoadRequestId += 1;
      packageLoadRequestId += 1;
      loadStateRequestId += 1;
      activePackageQueryKey = null;
      activeReorderOperationId = null;
      activeLoadOperations.clear();
      activeMutationOperations.clear();
      set({
        billingCycles: [],
        methods: [],
        planGroups: [],
        packageGroups: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
        hasLoaded: false,
        catalogReady: false,
        loading: false,
        refreshing: false,
        saving: false,
        sortingScope: null,
        error: null,
        loadError: null,
      });
    },
  };
});

registerSessionStoreReset("package", () => usePackageStore.getState().reset());
