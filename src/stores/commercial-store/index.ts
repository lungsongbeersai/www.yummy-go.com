"use client";

import { create } from "zustand";
import { ServiceError } from "@/lib/api";
import { canViewStoreBranch } from "@/lib/permissions";
import { getBranchManagementStoreOptions, getBranchOptions, type Branch, type BranchManagementStore } from "@/services/branch";
import * as commercial from "@/services/commercial";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { commercialBranches, commercialBranchRows, commercialStores, mergeCommercialDocument, newestCommercialDocument } from "@/stores/commercial-store/helpers";
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
  catalogReady: boolean;
  catalogOwnerUuid: string;
  catalogSaving: boolean;
  documentsLoading: boolean;
  catalogError: string | null;
  documentsError: string | null;
  catalog: commercial.CatalogItem[];
  documents: commercial.CommercialDocument[];
  selectedDocument: commercial.CommercialDocument | null;
  editingDocument: commercial.CommercialDocument | null;
  editorGeneration: number;
  editConflict: boolean;
  revisionDocumentUuid: string | null;
  revisions: commercial.CommercialDocumentRevision[];
  revisionsLoading: boolean;
  revisionsError: string | null;
  initialize: (input?: CommercialScopeInput) => Promise<void>;
  selectStore: (storeUuid: string, branchUuid?: string) => Promise<void>;
  selectBranch: (branchUuid: string) => void;
  loadCatalog: () => Promise<void>;
  loadDocuments: () => Promise<void>;
  saveItem: (input: commercial.SaveCatalogItemInput) => Promise<commercial.CatalogItem | null>;
  createDocument: (input: commercial.CreateCommercialDocumentInput) => Promise<commercial.CommercialDocument | null>;
  beginEdit: (documentUuid: string) => Promise<void>;
  closeEditor: () => void;
  updateDocument: (input: commercial.UpdateCommercialDocumentInput) => Promise<commercial.CommercialDocument | null>;
  openRevisions: (documentUuid: string) => Promise<void>;
  closeRevisions: () => void;
  openDocument: (documentUuid: string) => Promise<commercial.CommercialDocument | null>;
  convertQuotation: (input: commercial.ConvertQuotationInput) => Promise<commercial.CommercialDocument | null>;
  closeDocument: () => void;
  clearError: () => void;
  reset: () => void;
}

let scopeGeneration = 0;
let catalogGeneration = 0;
let catalogRequest = 0;
let documentsRequest = 0;
let detailRequest = 0;
let editRequest = 0;
let revisionRequest = 0;

const emptyDocumentWorkspace = {
  documents: [], selectedDocument: null, documentsLoading: false, documentsError: null,
  editingDocument: null, editorGeneration: 0, editConflict: false,
  revisionDocumentUuid: null, revisions: [], revisionsLoading: false, revisionsError: null,
  saving: false, loading: false, error: null,
};
const emptyWorkspace = {
  ...emptyDocumentWorkspace, catalog: [], catalogLoading: false, catalogError: null,
  catalogReady: false, catalogOwnerUuid: "", catalogSaving: false,
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

  function catalogOwner() {
    const ownerUuid = authStoreUuid(useAuthStore.getState().user);
    if (!ownerUuid || ownerUuid !== get().catalogOwnerUuid) throw new ServiceError("The catalogue owner must match the authenticated store", 403);
    return ownerUuid;
  }

  function catalogGuard(ownerUuid: string) {
    const generation = catalogGeneration;
    const session = createSessionGuard();
    return () => session() && generation === catalogGeneration && ownerUuid === get().catalogOwnerUuid && ownerUuid === authStoreUuid(useAuthStore.getState().user);
  }

  function requireCatalogOwner(row: commercial.CatalogItem, ownerUuid: string) {
    if (row.catalog_store_uuid !== ownerUuid) throw new ServiceError("The catalogue response belongs to another store", 403);
  }

  function requireReturnedBranch(row: commercial.CommercialDocument, branchUuid: string) {
    if (row.branch_uuid !== branchUuid) throw new ServiceError("The response belongs to another branch", 403);
  }

  return {
    ...emptyWorkspace,
    stores: [], branches: [], storeUuid: "", branchUuid: "", canSelectStore: false,
    optionsLoading: false, optionsError: null,
    initialize: async (input = {}) => {
      const generation = ++scopeGeneration;
      catalogGeneration += 1;
      const session = createSessionGuard();
      const ownerUuid = authStoreUuid(useAuthStore.getState().user);
      set({ ...emptyWorkspace, catalogOwnerUuid: ownerUuid, stores: [], branches: [], storeUuid: "", branchUuid: "", optionsLoading: true, optionsError: null, canSelectStore: false });
      try {
        if (!ownerUuid) throw new ServiceError("No authenticated catalogue owner is available", 403);
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
      set({ ...emptyDocumentWorkspace, saving: get().catalogSaving, storeUuid, branchUuid: "", branches: [], optionsLoading: true, optionsError: null });
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
      set({ ...emptyDocumentWorkspace, saving: get().catalogSaving, branchUuid });
    },
    loadCatalog: async () => {
      const branchUuid = get().branchUuid;
      requireBranch(branchUuid);
      const ownerUuid = catalogOwner();
      const request = ++catalogRequest;
      const current = catalogGuard(ownerUuid);
      set({ catalogLoading: true, catalogError: null });
      try {
        const rows = await commercial.getCommercialCatalog(branchUuid);
        rows.forEach((row) => requireCatalogOwner(row, ownerUuid));
        if (request === catalogRequest && current()) set({ catalog: rows, catalogReady: true, catalogLoading: false });
      } catch (error) {
        if (request === catalogRequest && current()) {
          const forbidden = error instanceof ServiceError && error.statusCode === 403;
          if (forbidden) { catalogGeneration += 1; catalogRequest += 1; }
          set({
            catalogLoading: false, catalogError: errorMessage(error),
            ...(forbidden ? { catalog: [], catalogReady: false, catalogSaving: false, saving: get().catalogSaving ? false : get().saving } : {}),
          });
        }
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
        if (request === documentsRequest && current()) set((state) => ({ documents: commercialBranchRows(rows, branchUuid).map((row) => newestCommercialDocument(state.documents, row)), documentsLoading: false }));
      } catch (error) {
        if (request === documentsRequest && current()) set({ documentsLoading: false, documentsError: errorMessage(error) });
        throw error;
      }
    },
    saveItem: async (input) => {
      requireBranch(input.branch_uuid);
      if (!canViewStoreBranch(useAuthStore.getState().user?.status)) throw new ServiceError("Catalogue changes require management access", 403);
      const ownerUuid = catalogOwner();
      const current = catalogGuard(ownerUuid);
      const currentDocumentScope = scopeGuard(input.branch_uuid);
      set({ saving: true, catalogSaving: true, error: null });
      try {
        const row = await commercial.saveCatalogItem(input);
        requireCatalogOwner(row, ownerUuid);
        if (!current()) return null;
        catalogRequest += 1;
        set((state) => ({ catalog: [row, ...state.catalog.filter((item) => item.item_uuid !== row.item_uuid)], catalogLoading: false, catalogSaving: false, saving: false }));
        return currentDocumentScope() ? row : null;
      } catch (error) {
        if (current()) {
          const forbidden = error instanceof ServiceError && error.statusCode === 403;
          if (forbidden) { catalogGeneration += 1; catalogRequest += 1; }
          set({
            saving: false, catalogSaving: false, error: errorMessage(error),
            ...(forbidden ? { catalog: [], catalogReady: false, catalogLoading: false, catalogError: errorMessage(error) } : {}),
          });
        }
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
        const latest = newestCommercialDocument(get().documents, row);
        set((state) => ({ documents: mergeCommercialDocument(state.documents, latest), selectedDocument: latest, documentsLoading: false, saving: false }));
        return latest;
      } catch (error) {
        if (current()) set({ saving: false, error: errorMessage(error) });
        throw error;
      }
    },
    beginEdit: async (documentUuid) => {
      const branchUuid = get().branchUuid;
      requireBranch(branchUuid);
      const request = ++editRequest;
      detailRequest += 1;
      const current = scopeGuard(branchUuid);
      set({ loading: true, error: null });
      try {
        const row = await commercial.getCommercialDocument(branchUuid, documentUuid);
        requireReturnedBranch(row, branchUuid);
        if (row.document_uuid !== documentUuid || !Number.isInteger(row.version) || row.version < 1) throw new ServiceError("The document version is unavailable", 409);
        if (request !== editRequest || !current()) return;
        const fresh = newestCommercialDocument(get().documents, row);
        set((state) => ({ documents: mergeCommercialDocument(state.documents, fresh), editingDocument: fresh, editorGeneration: request, selectedDocument: null, editConflict: false, loading: false }));
      } catch (error) {
        if (request === editRequest && current()) set({ loading: false, error: errorMessage(error) });
        throw error;
      }
    },
    closeEditor: () => { editRequest += 1; set({ editingDocument: null, editConflict: false, error: null, loading: false }); },
    updateDocument: async (input) => {
      requireBranch(input.branch_uuid);
      const current = scopeGuard(input.branch_uuid);
      set({ saving: true, error: null, editConflict: false });
      try {
        const row = await commercial.updateCommercialDocument(input);
        requireReturnedBranch(row, input.branch_uuid);
        if (row.document_uuid !== input.document_uuid) throw new ServiceError("The response belongs to another document", 403);
        if (!current()) return null;
        documentsRequest += 1;
        detailRequest += 1;
        editRequest += 1;
        const latest = newestCommercialDocument(get().documents, row);
        set((state) => ({ documents: mergeCommercialDocument(state.documents, latest), selectedDocument: latest, editingDocument: null, editConflict: false, documentsLoading: false, saving: false }));
        return latest;
      } catch (error) {
        if (current()) set({ saving: false, error: errorMessage(error), editConflict: error instanceof ServiceError && error.statusCode === 409 });
        throw error;
      }
    },
    openRevisions: async (documentUuid) => {
      const branchUuid = get().branchUuid;
      requireBranch(branchUuid);
      const request = ++revisionRequest;
      const current = scopeGuard(branchUuid);
      set({ revisionDocumentUuid: documentUuid, revisions: [], revisionsLoading: true, revisionsError: null });
      try {
        const rows = await commercial.getCommercialDocumentRevisions(branchUuid, documentUuid);
        for (const row of rows) {
          requireReturnedBranch(row.snapshot, branchUuid);
          if (row.snapshot.document_uuid !== documentUuid || row.snapshot.version !== row.version) throw new ServiceError("The revision belongs to another document", 403);
        }
        if (request === revisionRequest && current()) set({ revisions: rows, revisionsLoading: false });
      } catch (error) {
        if (request === revisionRequest && current()) set({ revisionsLoading: false, revisionsError: errorMessage(error) });
        throw error;
      }
    },
    closeRevisions: () => { revisionRequest += 1; set({ revisionDocumentUuid: null, revisions: [], revisionsLoading: false, revisionsError: null }); },
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
        const latest = newestCommercialDocument(get().documents, row);
        set((state) => ({ documents: mergeCommercialDocument(state.documents, latest), selectedDocument: latest, loading: false }));
        return latest;
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
          documents: mergeCommercialDocument(state.documents, row).map((document) => document.document_uuid === input.document_uuid ? { ...document, receipt_uuid: row.document_uuid } : document),
          selectedDocument: newestCommercialDocument(state.documents, row), documentsLoading: false, saving: false,
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
      catalogGeneration += 1;
      catalogRequest += 1;
      documentsRequest += 1;
      detailRequest += 1;
      editRequest += 1;
      revisionRequest += 1;
      set({ ...emptyWorkspace, stores: [], branches: [], storeUuid: "", branchUuid: "", canSelectStore: false, optionsLoading: false, optionsError: null });
    },
  };
});

registerSessionStoreReset("commercial", () => useCommercialStore.getState().reset());
