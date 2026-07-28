"use client";

import { create } from "zustand";
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
  type SavePackageInput
} from "@/services/package";
import {
  replacePackageDetailOrder,
  replacePlanGroupOrder,
  withCycleOrder
} from "@/stores/package-store-helpers";
import {
  createSessionGuard,
  registerSessionStoreReset
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
  loading: boolean;
  refreshing: boolean;
  saving: boolean;
  sortingScope: PackageSortingScope;
  error: string | null;
  loadCatalog: (query: PackageQuery, options?: PackageLoadOptions) => Promise<void>;
  loadPackages: (query: PackageQuery, options?: PackageLoadOptions) => Promise<void>;
  createPlan: (input: CreatePackagePlanInput, query: PackageQuery) => Promise<void>;
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

let catalogLoadRequestId = 0;
let packageLoadRequestId = 0;

export const usePackageStore = create<PackageState>((set, get) => ({
  billingCycles: [],
  methods: [],
  planGroups: [],
  packageGroups: [],
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasLoaded: false,
  loading: false,
  refreshing: false,
  saving: false,
  sortingScope: null,
  error: null,
  loadCatalog: async (query, options) => {
    const catalogRequestId = ++catalogLoadRequestId;
    const packageRequestId = ++packageLoadRequestId;
    const isCurrentSession = createSessionGuard();
    const background = Boolean(options?.background && get().hasLoaded);

    set({ error: null, loading: !background, refreshing: background });

    try {
      const [billingCycles, methods, planGroups, packagePage] = await Promise.all([
        fetchBillingCycles(query.language),
        fetchPackageMethods(query.language),
        fetchPackagePlanGroups(query.language),
        fetchPackagePage(query)
      ]);

      if (!isCurrentSession()) return;

      const isCurrentCatalogRequest = catalogRequestId === catalogLoadRequestId;
      const isCurrentPackageRequest = packageRequestId === packageLoadRequestId;
      if (!isCurrentCatalogRequest && !isCurrentPackageRequest) return;

      set({
        ...(isCurrentCatalogRequest
          ? { billingCycles, methods, planGroups }
          : {}),
        ...(isCurrentPackageRequest
          ? {
              packageGroups: packagePage.groups,
              page: packagePage.page,
              limit: packagePage.limit,
              total: packagePage.total,
              totalPages: packagePage.totalPages,
              hasLoaded: true,
              loading: false,
              refreshing: false
            }
          : {})
      });
    } catch (error) {
      if (isCurrentSession()) {
        const isCurrentCatalogRequest = catalogRequestId === catalogLoadRequestId;
        const isCurrentPackageRequest = packageRequestId === packageLoadRequestId;

        if (isCurrentCatalogRequest || isCurrentPackageRequest) {
          set({
            error: errorMessage(error),
            ...(isCurrentPackageRequest
              ? { loading: false, refreshing: false }
              : {})
          });
        }
      }
      throw error;
    }
  },
  loadPackages: async (query, options) => {
    const requestId = ++packageLoadRequestId;
    const isCurrentSession = createSessionGuard();
    const background = Boolean(options?.background && get().hasLoaded);

    set({ error: null, loading: !background, refreshing: background });

    try {
      const packagePage = await fetchPackagePage(query);
      if (requestId === packageLoadRequestId && isCurrentSession()) {
        set({
          packageGroups: packagePage.groups,
          page: packagePage.page,
          limit: packagePage.limit,
          total: packagePage.total,
          totalPages: packagePage.totalPages,
          hasLoaded: true,
          loading: false,
          refreshing: false
        });
      }
    } catch (error) {
      if (requestId === packageLoadRequestId && isCurrentSession()) {
        set({
          error: errorMessage(error),
          loading: false,
          refreshing: false
        });
      }
      throw error;
    }
  },
  createPlan: async (input, query) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });

    try {
      await createPackagePlanRequest(input);
    } catch (error) {
      if (isCurrentSession()) {
        set({ error: errorMessage(error), saving: false });
      }
      throw error;
    }

    if (!isCurrentSession()) return;
    set({ saving: false });
    await get().loadCatalog(query, { background: true });
  },
  save: async (input, query) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });

    try {
      await savePackageRequest(input);
    } catch (error) {
      if (isCurrentSession()) {
        set({ error: errorMessage(error), saving: false });
      }
      throw error;
    }

    if (!isCurrentSession()) return;
    set({ saving: false });
    await get().loadPackages(query, { background: true });
  },
  sortCycles: async (cycles, query) => {
    const isCurrentSession = createSessionGuard();
    const previousBillingCycles = get().billingCycles;
    const orderedCycles = withCycleOrder(cycles);

    set({
      billingCycles: orderedCycles,
      sortingScope: "cycles",
      error: null
    });

    try {
      await reorderBillingCycles(orderedCycles);
    } catch (error) {
      if (isCurrentSession()) {
        set({
          billingCycles: previousBillingCycles,
          sortingScope: null,
          error: errorMessage(error)
        });
      }
      throw error;
    }

    if (!isCurrentSession()) return;
    set({ sortingScope: null });
    await get().loadCatalog(query, { background: true });
  },
  sortPlans: async (cycleId, plans, query) => {
    const isCurrentSession = createSessionGuard();
    const previousPlanGroups = get().planGroups;
    const orderedPlanGroups = replacePlanGroupOrder(
      previousPlanGroups,
      cycleId,
      plans
    );
    if (orderedPlanGroups === previousPlanGroups) return;

    const orderedPlans =
      orderedPlanGroups.find((group) => group.billingCycleId === cycleId)?.plans ?? [];

    set({
      planGroups: orderedPlanGroups,
      sortingScope: `plans:${cycleId}`,
      error: null
    });

    try {
      await reorderPackagePlans(cycleId, orderedPlans);
    } catch (error) {
      if (isCurrentSession()) {
        set({
          planGroups: previousPlanGroups,
          sortingScope: null,
          error: errorMessage(error)
        });
      }
      throw error;
    }

    if (!isCurrentSession()) return;
    set({ sortingScope: null });
    await get().loadCatalog(query, { background: true });
  },
  sortDetails: async (packageId, details, query) => {
    const isCurrentSession = createSessionGuard();
    const previousPackageGroups = get().packageGroups;
    const orderedPackageGroups = replacePackageDetailOrder(
      previousPackageGroups,
      packageId,
      details
    );
    if (orderedPackageGroups === previousPackageGroups) return;

    const orderedDetails = orderedPackageGroups
      .flatMap((group) => group.methods)
      .flatMap((method) => method.packages)
      .find((item) => item.id === packageId)?.details ?? [];

    set({
      packageGroups: orderedPackageGroups,
      sortingScope: `details:${packageId}`,
      error: null
    });

    try {
      await reorderPackageDetails(packageId, orderedDetails);
    } catch (error) {
      if (isCurrentSession()) {
        set({
          packageGroups: previousPackageGroups,
          sortingScope: null,
          error: errorMessage(error)
        });
      }
      throw error;
    }

    if (!isCurrentSession()) return;
    set({ sortingScope: null });
    await get().loadPackages(query, { background: true });
  },
  reset: () => {
    catalogLoadRequestId += 1;
    packageLoadRequestId += 1;
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
      loading: false,
      refreshing: false,
      saving: false,
      sortingScope: null,
      error: null
    });
  }
}));

registerSessionStoreReset("package", () => usePackageStore.getState().reset());
