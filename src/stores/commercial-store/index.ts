"use client";

import { create } from "zustand";
import { ServiceError } from "@/lib/api";
import { getBranchManagementStoreOptions, getBranchOptions, type Branch, type BranchManagementStore } from "@/services/branch";
import * as commercial from "@/services/commercial";
import { useAuthStore } from "@/stores/auth-store";
import { commercialBranches, commercialBranchRows, commercialStores } from "@/stores/commercial-store/helpers";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage, type AsyncSlice } from "@/stores/store-utils";

interface CommercialScopeInput {
  storeUuid?: string;
  branchUuid?: string;
}

interface CommercialState extends AsyncSlice {
  stores: BranchManagementStore[];
  branches: Branch[];
  storeUuid: string;
  branchUuid: string;
  canSelectStore: boolean;
  optionsLoading: boolean;
  optionsError: string | null;
  catalogLoading: boolean;
  documentsLoading: boolean;
  catalogError: string | null;
  documentsError: string | null;
  catalog: commercial.CatalogItem[];
  documents: commercial.CommercialDocument[];
  selectedDocument: commercial.CommercialDocument | null;
  initialize: (input?: CommercialScopeInput) => Promise<void>;
  selectStore: (storeUuid: string, branchUuid?: string) => Promise<void>;
  selectBranch: (branchUuid: string) => void;
  loadCatalog: () => Promise<void>;
  loadDocuments: () => Promise<void>;
  saveItem: (input: commercial.SaveCatalogItemInput) => Promise<commercial.CatalogItem | null>;
  createDocument: (input: commercial.CreateCommercialDocumentInput) => Promise<commercial.CommercialDocument | null>;
  openDocument: (documentUuid: string) => Promise<commercial.CommercialDocument | null>;
  convertQuotation: (input: commercial.ConvertQuotationInput) => Promise<commercial.CommercialDocument | null>;
  closeDocument: () => void;
  clearError: () => void;
  reset: () => void;
}

let scopeGeneration = 0;
let catalogRequest = 0;
let documentsRequest = 0;
let detailRequest = 0;

const emptyWorkspace = {
  catalog: [], documents: [], selectedDocument: null,
  catalogLoading: false, documentsLoading: false, catalogError: null, documentsError: null,
  saving: false, loading: false, error: null,
};

export const useCommercialStore = create<CommercialState>((set, get) => {
  function scopeGuard(branchUuid = get().branchUuid) {
    const generation = scopeGeneration;
    const session = createSessionGuard();
    return () => session() && generation === scopeGeneration && branchUuid === get().branchUuid;
  }

  function requireBranch(branchUuid: string) {
    if (!branchUuid || branchUuid !== get().branchUuid || !get().branches.some((branch) => branch.branch_uuid === branchUuid)) {
      throw new ServiceError("Please select an authorized branch", 403);
    }
  }

  function requireReturnedBranch(row: commercial.CatalogItem | commercial.CommercialDocument, branchUuid: string) {
    if (row.branch_uuid !== branchUuid) throw new ServiceError("The response belongs to another branch", 403);
  }

  return {
    ...emptyWorkspace,
    stores: [], branches: [], storeUuid: "", branchUuid: "", canSelectStore: false,
    optionsLoading: false, optionsError: null,
    initialize: async (input = {}) => {
      const generation = ++scopeGeneration;
      const session = createSessionGuard();
      set({ ...emptyWorkspace, stores: [], branches: [], storeUuid: "", branchUuid: "", optionsLoading: true, optionsError: null, canSelectStore: false });
      try {
        const options = await getBranchManagementStoreOptions();
        if (generation !== scopeGeneration || !session()) return;
        const stores = commercialStores(options);
        const requestedStore = input.storeUuid || options.scope.store_uuid;
        const storeUuid = stores.some((store) => store.store_uuid === requestedStore) ? requestedStore : options.scope.store_uuid;
        if (!stores.some((store) => store.store_uuid === storeUuid)) throw new ServiceError("No authorized store is available", 403);
        set({ stores, canSelectStore: options.scope.can_select_store });
        await get().selectStore(storeUuid, input.branchUuid);
      } catch (error) {
        if (generation === scopeGeneration && session()) set({ optionsLoading: false, optionsError: errorMessage(error) });
        throw error;
      }
    },
    selectStore: async (storeUuid, defaultBranchUuid) => {
      if (!get().stores.some((store) => store.store_uuid === storeUuid)) return;
      const generation = ++scopeGeneration;
      const session = createSessionGuard();
      const user = useAuthStore.getState().user;
      set({ ...emptyWorkspace, storeUuid, branchUuid: "", branches: [], optionsLoading: true, optionsError: null });
      try {
        const rows = await getBranchOptions(storeUuid);
        if (generation !== scopeGeneration || !session()) return;
        const branches = commercialBranches(rows, storeUuid, Number(user?.status), user?.branch_uuid ?? "");
        const requested = defaultBranchUuid || user?.branch_uuid || "";
        const branchUuid = branches.some((branch) => branch.branch_uuid === requested) ? requested : branches[0]?.branch_uuid ?? "";
        set({ branches, branchUuid, optionsLoading: false });
      } catch (error) {
        if (generation === scopeGeneration && session()) set({ optionsLoading: false, optionsError: errorMessage(error) });
        throw error;
      }
    },
    selectBranch: (branchUuid) => {
      if (!get().branches.some((branch) => branch.branch_uuid === branchUuid) || branchUuid === get().branchUuid) return;
      scopeGeneration += 1;
      set({ ...emptyWorkspace, branchUuid });
    },
    loadCatalog: async () => {
      const branchUuid = get().branchUuid;
      requireBranch(branchUuid);
      const request = ++catalogRequest;
      const current = scopeGuard(branchUuid);
      set({ catalogLoading: true, catalogError: null });
      try {
        const rows = await commercial.getCommercialCatalog(branchUuid);
        if (request === catalogRequest && current()) set({ catalog: commercialBranchRows(rows, branchUuid), catalogLoading: false });
      } catch (error) {
        if (request === catalogRequest && current()) set({ catalogLoading: false, catalogError: errorMessage(error) });
        throw error;
      }
    },
    loadDocuments: async () => {
      const branchUuid = get().branchUuid;
      requireBranch(branchUuid);
      const request = ++documentsRequest;
      const current = scopeGuard(branchUuid);
      set({ documentsLoading: true, documentsError: null });
      try {
        const rows = await commercial.getCommercialDocuments(branchUuid);
        if (request === documentsRequest && current()) set({ documents: commercialBranchRows(rows, branchUuid), documentsLoading: false });
      } catch (error) {
        if (request === documentsRequest && current()) set({ documentsLoading: false, documentsError: errorMessage(error) });
        throw error;
      }
    },
    saveItem: async (input) => {
      requireBranch(input.branch_uuid);
      const current = scopeGuard(input.branch_uuid);
      set({ saving: true, error: null });
      try {
        const row = await commercial.saveCatalogItem(input);
        requireReturnedBranch(row, input.branch_uuid);
        if (!current()) return null;
        catalogRequest += 1;
        set((state) => ({ catalog: [row, ...state.catalog.filter((item) => item.item_uuid !== row.item_uuid)], catalogLoading: false, saving: false }));
        return row;
      } catch (error) {
        if (current()) set({ saving: false, error: errorMessage(error) });
        throw error;
      }
    },
    createDocument: async (input) => {
      requireBranch(input.branch_uuid);
      const current = scopeGuard(input.branch_uuid);
      set({ saving: true, error: null });
      try {
        const row = await commercial.createCommercialDocument(input);
        requireReturnedBranch(row, input.branch_uuid);
        if (!current()) return null;
        documentsRequest += 1;
        set((state) => ({ documents: [row, ...state.documents.filter((document) => document.document_uuid !== row.document_uuid)], selectedDocument: row, documentsLoading: false, saving: false }));
        return row;
      } catch (error) {
        if (current()) set({ saving: false, error: errorMessage(error) });
        throw error;
      }
    },
    openDocument: async (documentUuid) => {
      const branchUuid = get().branchUuid;
      requireBranch(branchUuid);
      const request = ++detailRequest;
      const current = scopeGuard(branchUuid);
      set({ loading: true, selectedDocument: null, error: null });
      try {
        const row = await commercial.getCommercialDocument(branchUuid, documentUuid);
        requireReturnedBranch(row, branchUuid);
        if (request !== detailRequest || !current()) return null;
        set({ selectedDocument: row, loading: false });
        return row;
      } catch (error) {
        if (request === detailRequest && current()) set({ loading: false, error: errorMessage(error) });
        throw error;
      }
    },
    convertQuotation: async (input) => {
      requireBranch(input.branch_uuid);
      const current = scopeGuard(input.branch_uuid);
      set({ saving: true, error: null });
      try {
        const row = await commercial.convertQuotation(input);
        requireReturnedBranch(row, input.branch_uuid);
        if (!current()) return null;
        documentsRequest += 1;
        set((state) => ({
          documents: [row, ...state.documents.filter((document) => document.document_uuid !== row.document_uuid).map((document) => document.document_uuid === input.document_uuid ? { ...document, receipt_uuid: row.document_uuid } : document)],
          selectedDocument: row, documentsLoading: false, saving: false,
        }));
        return row;
      } catch (error) {
        if (current()) set({ saving: false, error: errorMessage(error) });
        throw error;
      }
    },
    closeDocument: () => { detailRequest += 1; set({ selectedDocument: null, loading: false }); },
    clearError: () => set({ error: null }),
    reset: () => {
      scopeGeneration += 1;
      catalogRequest += 1;
      documentsRequest += 1;
      detailRequest += 1;
      set({ ...emptyWorkspace, stores: [], branches: [], storeUuid: "", branchUuid: "", canSelectStore: false, optionsLoading: false, optionsError: null });
    },
  };
});

registerSessionStoreReset("commercial", () => useCommercialStore.getState().reset());
