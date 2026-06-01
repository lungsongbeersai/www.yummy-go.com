"use client";

import { create } from "zustand";
import {
  getBranchOptions,
  getBranchQrUrl,
  getStoreUuid,
  setStoreUuid,
  type Branch
} from "@/services/branch";
import { getCategoryOptions, sortCategories, type Category, type SortCategoryInput } from "@/services/category";
import { getColorOptions, type Color } from "@/services/color";
import { getCurrencyOptions, type Currency } from "@/services/currency";
import { getGroupOptions, type Group } from "@/services/group";
import { getProductImageUrl } from "@/services/product";
import { getProvinceOptions, type Province } from "@/services/province";
import { getSizeOptions, type Size } from "@/services/size";
import { getStoreLogoUrl, getStoreOptions, resetStorePassword, type Store } from "@/services/store";
import { getTableOptions, type ZoneGroup } from "@/services/table";
import { getToppingOptions, type Topping } from "@/services/topping";
import { getUnitOptions, type Unit } from "@/services/unit";
import { canCreateUser, getRoles, getUserById, getUserProfileUrl, type Role, type User } from "@/services/user";
import { getZoneOptions, type Zone } from "@/services/zone";
import type { ApiEntity } from "@/services/shared/types";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { errorMessage } from "@/stores/store-utils";

type ReferenceKey =
  | "stores"
  | "branches"
  | "provinces"
  | "groups"
  | "categories"
  | "toppings"
  | "colors"
  | "currencies"
  | "sizes"
  | "units"
  | "zones"
  | "tables"
  | "roles";

interface ReferenceState {
  storeUuid: string;
  options: Partial<Record<ReferenceKey, ApiEntity[]>>;
  selectedUser: User | null;
  loadingKeys: Partial<Record<ReferenceKey | "user" | "password" | "sort", boolean>>;
  error: string | null;
  setActiveStore: (storeUuid: string) => void;
  loadStores: (lang?: string) => Promise<Store[]>;
  loadBranches: (storeUuid?: string, lang?: string) => Promise<Branch[]>;
  loadProvinces: (lang?: string) => Promise<Province[]>;
  loadGroups: (lang?: string, storeUuid?: string) => Promise<Group[]>;
  loadCategories: (lang?: string, storeUuid?: string) => Promise<Category[]>;
  loadToppings: (lang?: string, storeUuid?: string) => Promise<Topping[]>;
  loadColors: () => Promise<Color[]>;
  loadCurrencies: () => Promise<Currency[]>;
  loadSizes: (lang?: string, storeUuid?: string) => Promise<Size[]>;
  loadUnits: (lang?: string, storeUuid?: string) => Promise<Unit[]>;
  loadZones: (lang?: string, branchUuid?: string) => Promise<Zone[]>;
  loadTables: (lang?: string) => Promise<ZoneGroup[]>;
  loadRoles: (lang?: string, rolesId?: number | string) => Promise<Role[]>;
  loadUser: (loginUuid: string) => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
  sortCategoryRows: (input: SortCategoryInput) => ReturnType<typeof sortCategories>;
  canCreateUser: () => boolean;
  branchQrUrl: (filename: string) => string;
  storeLogoUrl: (filename: string) => string;
  productImageUrl: (filename: string) => string;
  userProfileUrl: (profilePath: string | null) => string;
  reset: () => void;
}

export const useReferenceStore = create<ReferenceState>((set) => {
  const activeStoreUuid = () => getStoreUuid() || authStoreUuid(useAuthStore.getState().user);

  async function loadOption<T extends ApiEntity>(key: ReferenceKey, loader: () => Promise<T[]>) {
    set((state) => ({
      loadingKeys: { ...state.loadingKeys, [key]: true },
      error: null
    }));
    try {
      const rows = await loader();
      set((state) => ({
        options: { ...state.options, [key]: rows },
        loadingKeys: { ...state.loadingKeys, [key]: false }
      }));
      return rows;
    } catch (error) {
      set((state) => ({
        loadingKeys: { ...state.loadingKeys, [key]: false },
        error: errorMessage(error)
      }));
      throw error;
    }
  }

  return {
    storeUuid: activeStoreUuid(),
    options: {},
    selectedUser: null,
    loadingKeys: {},
    error: null,
    setActiveStore: (storeUuid) => {
      setStoreUuid(storeUuid);
      set({ storeUuid });
    },
    loadStores: (lang) => loadOption("stores", () => getStoreOptions(lang)),
    loadBranches: (storeUuid) => loadOption("branches", () => getBranchOptions(storeUuid ?? activeStoreUuid())),
    loadProvinces: (lang) => loadOption("provinces", () => getProvinceOptions(lang)),
    loadGroups: (lang, storeUuid) => loadOption("groups", () => getGroupOptions(lang, storeUuid ?? activeStoreUuid())),
    loadCategories: (lang, storeUuid) => loadOption("categories", () => getCategoryOptions(lang, storeUuid)),
    loadToppings: (lang, storeUuid) =>
      loadOption("toppings", () => getToppingOptions(lang, storeUuid ?? activeStoreUuid())),
    loadColors: () => loadOption("colors", getColorOptions),
    loadCurrencies: () => loadOption("currencies", getCurrencyOptions),
    loadSizes: (lang, storeUuid) =>
      loadOption("sizes", () => getSizeOptions(lang, storeUuid ?? activeStoreUuid())),
    loadUnits: (lang, storeUuid) =>
      loadOption("units", () => getUnitOptions(lang, storeUuid ?? activeStoreUuid())),
    loadZones: (lang, branchUuid) => loadOption("zones", () => getZoneOptions(lang, branchUuid)),
    loadTables: (lang) => loadOption("tables", () => getTableOptions(lang)),
    loadRoles: (lang, rolesId) => loadOption("roles", () => getRoles(lang, rolesId ?? useAuthStore.getState().user?.status ?? "")),
    loadUser: async (loginUuid) => {
      set((state) => ({ loadingKeys: { ...state.loadingKeys, user: true }, error: null }));
      try {
        const selectedUser = await getUserById(loginUuid);
        set((state) => ({
          selectedUser,
          loadingKeys: { ...state.loadingKeys, user: false }
        }));
        return selectedUser;
      } catch (error) {
        set((state) => ({
          loadingKeys: { ...state.loadingKeys, user: false },
          error: errorMessage(error)
        }));
        throw error;
      }
    },
    resetPassword: async (email) => {
      set((state) => ({ loadingKeys: { ...state.loadingKeys, password: true }, error: null }));
      try {
        await resetStorePassword(email);
        set((state) => ({ loadingKeys: { ...state.loadingKeys, password: false } }));
      } catch (error) {
        set((state) => ({
          loadingKeys: { ...state.loadingKeys, password: false },
          error: errorMessage(error)
        }));
        throw error;
      }
    },
    sortCategoryRows: (input) => sortCategories(input),
    canCreateUser: () => canCreateUser(useAuthStore.getState().user?.status),
    branchQrUrl: getBranchQrUrl,
    storeLogoUrl: getStoreLogoUrl,
    productImageUrl: getProductImageUrl,
    userProfileUrl: getUserProfileUrl,
    reset: () =>
      set({
        storeUuid: activeStoreUuid(),
        options: {},
        selectedUser: null,
        loadingKeys: {},
        error: null
      })
  };
});
