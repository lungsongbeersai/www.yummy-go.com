"use client";

import { create } from "zustand";
import { ServiceError } from "@/lib/api";
import { canViewStoreBranch } from "@/lib/permissions";
import { getBranchManagementStoreOptions, getBranchOptions, type Branch, type BranchManagementStore } from "@/services/branch";
import * as commercial from "@/services/commercial";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { commercialBranches, commercialBranchRows, commercialDocumentNeedsHydration, commercialStores, mergeCommercialDocument, newestCommercialDocument } from "@/stores/commercial-store/helpers";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage, type AsyncSlice } from "@/stores/store-utils";

interface CommercialScopeInput {
  storeUuid?: string;
  branchUuid?: string;
}

interface CommercialState extends AsyncSlice {
  paymentProfiles: commercial.CommercialPaymentProfile[];
  paymentOwnerUuid: string;
  paymentProfilesLoading: boolean;
  paymentProfilesReady: boolean;
  paymentProfilesSaving: boolean;
  paymentProfilesError: string | null;
  loadPaymentProfiles: () => Promise<void>;
  savePaymentProfile: (input: commercial.SaveCommercialPaymentProfileInput) => Promise<commercial.CommercialPaymentProfile | null>;
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
  revisionSnapshot: commercial.CommercialDocument | null;
  revisionSnapshotLoading: boolean;
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
  openRevision: (version: number) => Promise<void>;
  closeRevision: () => void;
  openDocument: (documentUuid: string) => Promise<commercial.CommercialDocument | null>;
  convertQuotation: (input: commercial.ConvertQuotationInput) => Promise<commercial.CommercialDocument | null>;
  closeDocument: () => void;
  clearError: () => void;
  enterRoute: () => number;
  leaveRoute: (lease: number) => void;
  reset: () => void;
}

let scopeGeneration = 0;
let catalogGeneration = 0;
let catalogRequest = 0;
let documentsRequest = 0;
let detailRequest = 0;
let editRequest = 0;
let revisionRequest = 0;
let revisionDetailRequest = 0;
let routeGeneration = 0;
let activeRouteLease = 0;
let paymentGeneration = 0;
let paymentRequest = 0;

const emptyPayments = {
  paymentProfiles: [], paymentOwnerUuid: "", paymentProfilesLoading: false,
  paymentProfilesReady: false, paymentProfilesSaving: false, paymentProfilesError: null,
};

const emptyDocumentWorkspace = {
  documents: [], selectedDocument: null, documentsLoading: false, documentsError: null,
  editingDocument: null, editorGeneration: 0, editConflict: false,
  revisionDocumentUuid: null, revisions: [], revisionsLoading: false, revisionsError: null, revisionSnapshot: null, revisionSnapshotLoading: false,
  saving: false, loading: false, error: null,
};
const emptyWorkspace = {
  ...emptyDocumentWorkspace, ...emptyPayments, catalog: [], catalogLoading: false, catalogError: null,
  catalogReady: false, catalogOwnerUuid: "", catalogSaving: false,
};

const emptyRouteState = {
  selectedDocument: null, editingDocument: null, editConflict: false, error: null, loading: false,
  revisionDocumentUuid: null, revisions: [], revisionsLoading: false, revisionsError: null, revisionSnapshot: null, revisionSnapshotLoading: false,
};

export const useCommercialStore = create<CommercialState>((set, get) => {
  function paymentOwner() {
    const { user, token } = useAuthStore.getState();
    const storeUuid = authStoreUuid(user);
    if (!user?.uuid || !storeUuid) {
      paymentGeneration += 1;
      set(emptyPayments);
      throw new ServiceError("No authenticated payment profile owner is available", 403);
    }
    const owner = `${user.uuid}:${storeUuid}`;
    if (get().paymentOwnerUuid !== owner) {
      paymentGeneration += 1;
      set({ ...emptyPayments, paymentOwnerUuid: owner });
    }
    const generation = paymentGeneration;
    const session = createSessionGuard();
    return () => {
      const current = useAuthStore.getState();
      return session() && generation === paymentGeneration && current.user?.uuid === user.uuid &&
        authStoreUuid(current.user) === storeUuid && current.token === token && get().paymentOwnerUuid === owner;
    };
  }

  function scopeGuard(branchUuid = get().branchUuid) {
    const generation = scopeGeneration;
    const session = createSessionGuard();
    return () => session() && generation === scopeGeneration && branchUuid === get().branchUuid;
  }

  function documentMutationGuard(branchUuid: string) {
    const current = scopeGuard(branchUuid);
    const lease = activeRouteLease;
    return () => current() && lease === activeRouteLease;
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

  async function fullDocument(row: commercial.CommercialDocument, branchUuid: string) {
    let latest = newestCommercialDocument(get().documents, row);
    if (!commercialDocumentNeedsHydration(latest)) return latest;
    const hydrated = await commercial.getCommercialDocument(branchUuid, row.document_uuid);
    requireReturnedBranch(hydrated, branchUuid);
    if (hydrated.document_uuid !== row.document_uuid) throw new ServiceError("The response belongs to another document", 403);
    latest = newestCommercialDocument(get().documents, hydrated);
    if (commercialDocumentNeedsHydration(latest)) throw new ServiceError("The latest document details could not be loaded. Please try again", 409);
    return latest;
  }

  return {
    ...emptyWorkspace,
    stores: [], branches: [], storeUuid: "", branchUuid: "", canSelectStore: false,
    optionsLoading: false, optionsError: null,
    loadPaymentProfiles: async () => {
      const current = paymentOwner();
      const request = ++paymentRequest;
      set({ paymentProfilesLoading: true, paymentProfilesError: null });
      try {
        const rows = await commercial.getCommercialPaymentProfiles();
        if (request === paymentRequest && current()) set({ paymentProfiles: rows, paymentProfilesLoading: false, paymentProfilesReady: true });
      } catch (error) {
        if (request === paymentRequest && current()) set({ paymentProfiles: [], paymentProfilesLoading: false, paymentProfilesReady: false, paymentProfilesError: errorMessage(error) });
        throw error;
      }
    },
    savePaymentProfile: async (input) => {
      const current = paymentOwner();
      set({ paymentProfilesSaving: true, paymentProfilesError: null });
      try {
        const row = await commercial.saveCommercialPaymentProfile(input);
        if (!current()) return null;
        paymentRequest += 1;
        set((state) => ({ paymentProfiles: [row, ...state.paymentProfiles.filter((profile) => profile.profile_uuid !== row.profile_uuid)], paymentProfilesSaving: false, paymentProfilesLoading: false }));
        return row;
      } catch (error) {
        if (current()) set({ paymentProfilesSaving: false, paymentProfilesError: errorMessage(error), ...(error instanceof ServiceError && error.statusCode === 403 ? { paymentProfiles: [], paymentProfilesReady: false } : {}) });
        throw error;
      }
    },
    initialize: async (input = {}) => {
      const generation = ++scopeGeneration;
      catalogGeneration += 1;
      paymentGeneration += 1;
      paymentRequest += 1;
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
      const current = documentMutationGuard(input.branch_uuid);
      set({ saving: true, error: null });
      try {
        const row = await commercial.createCommercialDocument(input);
        requireReturnedBranch(row, input.branch_uuid);
        if (!current()) return null;
        documentsRequest += 1;
        const latest = await fullDocument(row, input.branch_uuid);
        if (!current()) return null;
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
        const fresh = await fullDocument(row, branchUuid);
        if (request !== editRequest || !current()) return;
        set((state) => ({ documents: mergeCommercialDocument(state.documents, fresh), editingDocument: fresh, editorGeneration: request, selectedDocument: null, editConflict: false, loading: false }));
      } catch (error) {
        if (request === editRequest && current()) set({ loading: false, error: errorMessage(error) });
        throw error;
      }
    },
    closeEditor: () => { editRequest += 1; set({ editingDocument: null, editConflict: false, error: null, loading: false }); },
    updateDocument: async (input) => {
      requireBranch(input.branch_uuid);
      const current = documentMutationGuard(input.branch_uuid);
      set({ saving: true, error: null, editConflict: false });
      try {
        const row = await commercial.updateCommercialDocument(input);
        requireReturnedBranch(row, input.branch_uuid);
        if (row.document_uuid !== input.document_uuid) throw new ServiceError("The response belongs to another document", 403);
        if (!current()) return null;
        documentsRequest += 1;
        detailRequest += 1;
        editRequest += 1;
        const latest = await fullDocument(row, input.branch_uuid);
        if (!current()) return null;
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
      revisionDetailRequest += 1;
      set({ revisionDocumentUuid: documentUuid, revisions: [], revisionsLoading: true, revisionsError: null, revisionSnapshot: null, revisionSnapshotLoading: false });
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
    openRevision: async (version) => {
      const branchUuid = get().branchUuid;
      const documentUuid = get().revisionDocumentUuid;
      requireBranch(branchUuid);
      if (!documentUuid || !Number.isInteger(version) || version < 1) throw new ServiceError("Choose an available document version", 400);
      const request = ++revisionDetailRequest;
      const current = scopeGuard(branchUuid);
      set({ revisionSnapshot: null, revisionSnapshotLoading: true, revisionsError: null });
      try {
        const revision = await commercial.getCommercialDocumentRevision(branchUuid, documentUuid, version);
        requireReturnedBranch(revision.snapshot, branchUuid);
        if (revision.version !== version || revision.snapshot.version !== version || revision.snapshot.document_uuid !== documentUuid || commercialDocumentNeedsHydration(revision.snapshot)) throw new ServiceError("The requested document version could not be loaded", 409);
        if (request === revisionDetailRequest && current() && get().revisionDocumentUuid === documentUuid) set({ revisionSnapshot: revision.snapshot, revisionSnapshotLoading: false });
      } catch (error) {
        if (request === revisionDetailRequest && current() && get().revisionDocumentUuid === documentUuid) set({ revisionSnapshotLoading: false, revisionsError: errorMessage(error) });
        throw error;
      }
    },
    closeRevision: () => { revisionDetailRequest += 1; set({ revisionSnapshot: null, revisionSnapshotLoading: false }); },
    closeRevisions: () => { revisionRequest += 1; revisionDetailRequest += 1; set({ revisionDocumentUuid: null, revisions: [], revisionsLoading: false, revisionsError: null, revisionSnapshot: null, revisionSnapshotLoading: false }); },
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
        const latest = await fullDocument(row, branchUuid);
        if (request !== detailRequest || !current()) return null;
        set((state) => ({ documents: mergeCommercialDocument(state.documents, latest), selectedDocument: latest, loading: false }));
        return latest;
      } catch (error) {
        if (request === detailRequest && current()) set({ loading: false, error: errorMessage(error) });
        throw error;
      }
    },
    convertQuotation: async (input) => {
      requireBranch(input.branch_uuid);
      const current = documentMutationGuard(input.branch_uuid);
      set({ saving: true, error: null });
      try {
        const row = await commercial.convertQuotation(input);
        requireReturnedBranch(row, input.branch_uuid);
        if (!current()) return null;
        documentsRequest += 1;
        const latest = await fullDocument(row, input.branch_uuid);
        if (!current()) return null;
        set((state) => ({
          documents: mergeCommercialDocument(state.documents, latest).map((document) => document.document_uuid === input.document_uuid ? { ...document, receipt_uuid: row.document_uuid } : document),
          selectedDocument: latest, documentsLoading: false, saving: false,
        }));
        return latest;
      } catch (error) {
        if (current()) set({ saving: false, error: errorMessage(error) });
        throw error;
      }
    },
    closeDocument: () => { detailRequest += 1; set({ selectedDocument: null, loading: false }); },
    clearError: () => set({ error: null }),
    enterRoute: () => {
      activeRouteLease = ++routeGeneration;
      detailRequest += 1; editRequest += 1; revisionRequest += 1;
      revisionDetailRequest += 1;
      set({ ...emptyRouteState, saving: get().catalogSaving });
      return activeRouteLease;
    },
    leaveRoute: (lease) => {
      if (lease !== activeRouteLease) return;
      activeRouteLease = ++routeGeneration;
      detailRequest += 1; editRequest += 1; revisionRequest += 1;
      revisionDetailRequest += 1;
      set({ ...emptyRouteState, saving: get().catalogSaving });
    },
    reset: () => {
      activeRouteLease = ++routeGeneration;
      scopeGeneration += 1;
      catalogGeneration += 1;
      catalogRequest += 1;
      documentsRequest += 1;
      detailRequest += 1;
      editRequest += 1;
      revisionRequest += 1;
      revisionDetailRequest += 1;
      paymentGeneration += 1;
      paymentRequest += 1;
      set({ ...emptyWorkspace, stores: [], branches: [], storeUuid: "", branchUuid: "", canSelectStore: false, optionsLoading: false, optionsError: null });
    },
  };
});

registerSessionStoreReset("commercial", () => useCommercialStore.getState().reset());

useAuthStore.subscribe((current, previous) => {
  if (current.user?.uuid === previous.user?.uuid && authStoreUuid(current.user) === authStoreUuid(previous.user) && current.token === previous.token) return;
  paymentGeneration += 1;
  paymentRequest += 1;
  useCommercialStore.setState(emptyPayments);
});
