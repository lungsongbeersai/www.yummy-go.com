import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBranchManagementStoreOptions, getBranchOptions } from "@/services/branch";
import { createCommercialDocument, getCommercialCatalog, getCommercialDocument, getCommercialDocumentRevisions, getCommercialDocuments, saveCatalogItem, updateCommercialDocument, type CatalogItem, type CommercialDocument, type CommercialDocumentRevision, type CreateCommercialDocumentInput, type UpdateCommercialDocumentInput } from "@/services/commercial";
import { ServiceError } from "@/lib/api";
import { commercialLineInput, newCommercialLine } from "@/features/commercial/commercial-domain";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useCommercialStore } from "@/stores/commercial-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/branch", () => ({ getBranchManagementStoreOptions: vi.fn(), getBranchOptions: vi.fn() }));
vi.mock("@/services/commercial", () => ({ getCommercialCatalog: vi.fn(), getCommercialDocuments: vi.fn(), getCommercialDocument: vi.fn(), getCommercialDocumentRevisions: vi.fn(), updateCommercialDocument: vi.fn(), saveCatalogItem: vi.fn(), createCommercialDocument: vi.fn(), convertQuotation: vi.fn() }));

const user: AuthUser = { uuid: "user", email: "test@example.test", status: 2, profile: "", branch_uuid: "a", branch_name: "A", branch_tel: "", branch_address: "", store_uuid: "store", store_name: "Store", store_logo: "", store_table_status: 1 };
const branches = [{ branch_uuid: "a", store_uuid_fk: "store" }, { branch_uuid: "b", store_uuid_fk: "store" }];

function item(branchUuid = "a", ownerUuid = "store"): CatalogItem {
  return { item_uuid: "item", catalog_store_uuid: ownerUuid, branch_uuid: branchUuid, name: "Printer", description: "", unit: "unit", unit_price: 950000, image_url: "https://images.example.test/origin-branch/printer.webp", image_visible: true, active: true, created_at: "2026-11-14", updated_at: "2026-11-14" };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const input: CreateCommercialDocumentInput = { branch_uuid: "a", document_type: "quotation", issued_on: "2026-11-14", customer: { name: "Customer" }, issuer: { name: "PLC" }, show_images: true, tax_rate: 0, items: [{ name: "Printer", quantity: 1, unit_price: 950000 }] };
const saveInput = { branch_uuid: "a", name: "Printer", unit_price: 950000, active: true, image_visible: true };
const updateInput: UpdateCommercialDocumentInput = { ...input, document_uuid: "document", expected_version: 1, request_uuid: "operation-1", items: [{ ...input.items[0], line_uuid: "line-1" }] };

function document(branchUuid = "a"): CommercialDocument {
  return { ...input, version: 1, updated_at: "2026-11-14", updated_by: "operator", discount_type: null, discount_value: 0, discount_amount: 0, source_quotation_version: null, branch_uuid: branchUuid, document_uuid: "document", number: "QT-1", valid_until: null, notes: "", payment_method: "", subtotal: 950000, tax_amount: 0, total: 950000, source_quotation_uuid: null, receipt_uuid: null, created_at: "2026-11-14", items: [{ line_uuid: "line-1", item_uuid: "item", name: "Printer", quantity: 1, unit_price: 950000, line_total: 950000, image_url: item().image_url, show_image: true }] };
}

describe("commercial request scope ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useCommercialStore.getState().reset();
    useAuthStore.setState({ user });
    useCommercialStore.setState({ catalogOwnerUuid: "store", storeUuid: "store", branchUuid: "a", branches });
  });

  it("accepts a pending shared catalogue read after selecting another branch", async () => {
    const pending = deferred<CatalogItem[]>();
    vi.mocked(getCommercialCatalog).mockReturnValueOnce(pending.promise);
    const load = useCommercialStore.getState().loadCatalog();
    useCommercialStore.getState().selectBranch("b");
    pending.resolve([item("a")]);
    await load;
    expect(useCommercialStore.getState()).toMatchObject({ branchUuid: "b", catalog: [item("a")], catalogLoading: false, catalogReady: true });
  });

  it("prevents an in-flight read from erasing a successful item save", async () => {
    const pending = deferred<CatalogItem[]>();
    vi.mocked(getCommercialCatalog).mockReturnValueOnce(pending.promise);
    vi.mocked(saveCatalogItem).mockResolvedValueOnce(item());
    const load = useCommercialStore.getState().loadCatalog();
    await useCommercialStore.getState().saveItem({ branch_uuid: "a", name: "Printer", unit_price: 950000, active: true, image_visible: true });
    pending.resolve([]);
    await load;
    expect(useCommercialStore.getState().catalog).toEqual([item()]);
  });

  it("never commits a document from a prior login session", async () => {
    const pending = deferred<CommercialDocument>();
    vi.mocked(createCommercialDocument).mockReturnValueOnce(pending.promise);
    const save = useCommercialStore.getState().createDocument(input);
    resetSessionStores();
    pending.resolve(document());
    expect(await save).toBeNull();
    expect(useCommercialStore.getState()).toMatchObject({ documents: [], selectedDocument: null, saving: false });
  });

  it("rejects mutations to another branch before sending the request", async () => {
    await expect(useCommercialStore.getState().createDocument({ ...input, branch_uuid: "b" })).rejects.toThrow("authorized branch");
    expect(createCommercialDocument).not.toHaveBeenCalled();
  });

  it("rejects a save response from another catalogue owner and clears prior rows", async () => {
    useCommercialStore.setState({ catalog: [item()], catalogReady: true });
    vi.mocked(saveCatalogItem).mockResolvedValueOnce(item("b", "foreign-owner"));
    await expect(useCommercialStore.getState().saveItem(saveInput)).rejects.toThrow("another store");
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [], catalogReady: false, catalogSaving: false, saving: false, catalogError: "The catalogue response belongs to another store" });
  });

  it("resolves unauthorized store/branch deep links to the authenticated scope", async () => {
    useAuthStore.setState({ user: { ...user, status: 3 } });
    vi.mocked(getBranchManagementStoreOptions).mockResolvedValueOnce({ status: "success", message: "", data: [{ store_uuid: "store" }], scope: { can_select_store: false, store_uuid: "store" } });
    vi.mocked(getBranchOptions).mockResolvedValueOnce(branches);
    await useCommercialStore.getState().initialize({ storeUuid: "foreign", branchUuid: "b" });
    expect(getBranchOptions).toHaveBeenCalledWith("store");
    expect(useCommercialStore.getState()).toMatchObject({ catalogOwnerUuid: "store", storeUuid: "store", branchUuid: "a", branches: [branches[0]], optionsLoading: false });
  });

  it("reuses one catalogue and its original image across managed stores and branches", async () => {
    vi.mocked(getCommercialCatalog).mockResolvedValueOnce([item()]);
    await useCommercialStore.getState().loadCatalog();
    useCommercialStore.getState().selectBranch("b");
    expect(useCommercialStore.getState().catalog).toEqual([item()]);
    useCommercialStore.setState({ stores: [{ store_uuid: "store" }, { store_uuid: "customer-store" }] });
    vi.mocked(getBranchOptions).mockResolvedValueOnce([{ branch_uuid: "customer-branch", store_uuid_fk: "customer-store" }]);
    await useCommercialStore.getState().selectStore("customer-store", "customer-branch");
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [item()], catalogReady: true, catalogOwnerUuid: "store", storeUuid: "customer-store", branchUuid: "customer-branch", documents: [] });
    expect(getCommercialCatalog).toHaveBeenCalledTimes(1);

    const selectedItem = useCommercialStore.getState().catalog[0];
    expect(newCommercialLine(selectedItem).image_url).toBe(item().image_url);
    vi.mocked(createCommercialDocument).mockResolvedValueOnce(document("customer-branch"));
    const saved = await useCommercialStore.getState().createDocument({ ...input, branch_uuid: "customer-branch", items: [commercialLineInput(newCommercialLine(selectedItem))] });
    expect(createCommercialDocument).toHaveBeenCalledWith(expect.objectContaining({ branch_uuid: "customer-branch", items: [expect.objectContaining({ item_uuid: "item" })] }));
    expect(saved?.items[0].image_url).toBe(item().image_url);
  });

  it("accepts catalogue provenance from another branch during an authorized edit", async () => {
    useCommercialStore.getState().selectBranch("b");
    vi.mocked(saveCatalogItem).mockResolvedValueOnce(item("a"));
    expect(await useCommercialStore.getState().saveItem({ ...saveInput, branch_uuid: "b", item_uuid: "item" })).toEqual(item("a"));
    expect(useCommercialStore.getState().catalog[0].branch_uuid).toBe("a");
  });

  it("rejects the entire mixed-owner list rather than hiding only foreign rows", async () => {
    useCommercialStore.setState({ catalog: [item()], catalogReady: true });
    vi.mocked(getCommercialCatalog).mockResolvedValueOnce([item(), { ...item("b", "foreign-owner"), item_uuid: "foreign-item" }]);
    await expect(useCommercialStore.getState().loadCatalog()).rejects.toThrow("another store");
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [], catalogReady: false, catalogLoading: false, catalogError: "The catalogue response belongs to another store" });
  });

  it("does not restore cached catalogue data from an older read after an owner mismatch", async () => {
    useCommercialStore.setState({ catalog: [item()], catalogReady: true });
    const pending = deferred<CatalogItem[]>();
    vi.mocked(getCommercialCatalog).mockReturnValueOnce(pending.promise);
    const read = useCommercialStore.getState().loadCatalog();
    vi.mocked(saveCatalogItem).mockResolvedValueOnce(item("a", "foreign-owner"));
    await expect(useCommercialStore.getState().saveItem(saveInput)).rejects.toThrow("another store");
    pending.resolve([item()]);
    await read;
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [], catalogReady: false, catalogLoading: false, catalogError: "The catalogue response belongs to another store" });
  });

  it("does not restore cached catalogue data from an older save after an owner mismatch", async () => {
    const pending = deferred<CatalogItem>();
    vi.mocked(saveCatalogItem).mockReturnValueOnce(pending.promise);
    const saving = useCommercialStore.getState().saveItem(saveInput);
    vi.mocked(getCommercialCatalog).mockResolvedValueOnce([item("a", "foreign-owner")]);
    await expect(useCommercialStore.getState().loadCatalog()).rejects.toThrow("another store");
    pending.resolve(item());
    expect(await saving).toBeNull();
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [], catalogReady: false, catalogLoading: false, catalogSaving: false, saving: false });
  });

  it("lets branch administrators read and issue documents but blocks catalogue writes", async () => {
    useAuthStore.setState({ user: { ...user, status: 3 } });
    vi.mocked(getCommercialCatalog).mockResolvedValueOnce([item("b")]);
    await useCommercialStore.getState().loadCatalog();
    await expect(useCommercialStore.getState().saveItem(saveInput)).rejects.toThrow("management access");
    expect(saveCatalogItem).not.toHaveBeenCalled();
    vi.mocked(createCommercialDocument).mockResolvedValueOnce(document());
    expect(await useCommercialStore.getState().createDocument(input)).toEqual(document());
  });

  it("still rejects foreign document snapshots and filters history to its target branch", async () => {
    vi.mocked(createCommercialDocument).mockResolvedValueOnce(document("b"));
    await expect(useCommercialStore.getState().createDocument(input)).rejects.toThrow("another branch");
    expect(useCommercialStore.getState().documents).toEqual([]);
    vi.mocked(getCommercialDocuments).mockResolvedValueOnce([document(), document("b")]);
    await useCommercialStore.getState().loadDocuments();
    expect(useCommercialStore.getState().documents).toEqual([document()]);
  });

  it("does not let an older target's catalogue read overwrite a newer shared result", async () => {
    const old = deferred<CatalogItem[]>();
    vi.mocked(getCommercialCatalog).mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ ...item(), name: "Current printer" }]);
    const first = useCommercialStore.getState().loadCatalog();
    useCommercialStore.getState().selectBranch("b");
    await useCommercialStore.getState().loadCatalog();
    old.resolve([item()]);
    await first;
    expect(useCommercialStore.getState().catalog[0].name).toBe("Current printer");
  });

  it("commits a shared save after a target change without returning an old editor result", async () => {
    const pending = deferred<CatalogItem>();
    vi.mocked(saveCatalogItem).mockReturnValueOnce(pending.promise);
    const save = useCommercialStore.getState().saveItem(saveInput);
    useCommercialStore.getState().selectBranch("b");
    expect(useCommercialStore.getState().saving).toBe(true);
    pending.resolve(item());
    expect(await save).toBeNull();
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [item()], saving: false, catalogSaving: false, branchUuid: "b", selectedDocument: null });
  });

  it("does not turn a lost catalogue save response into a local success", async () => {
    useCommercialStore.setState({ catalog: [item()], catalogReady: true });
    vi.mocked(saveCatalogItem).mockRejectedValueOnce(new Error("Connection lost"));
    await expect(useCommercialStore.getState().saveItem({ ...saveInput, name: "New printer" })).rejects.toThrow("Connection lost");
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [item()], saving: false, catalogSaving: false, error: "Connection lost" });
  });

  it("ignores old-login catalogue reads and save errors after a new owner is initialized", async () => {
    const read = deferred<CatalogItem[]>();
    const save = deferred<CatalogItem>();
    vi.mocked(getCommercialCatalog).mockReturnValueOnce(read.promise);
    vi.mocked(saveCatalogItem).mockReturnValueOnce(save.promise);
    const loading = useCommercialStore.getState().loadCatalog();
    const saving = useCommercialStore.getState().saveItem(saveInput);
    resetSessionStores();
    useAuthStore.setState({ user: { ...user, store_uuid: "new-owner" } });
    useCommercialStore.setState({ catalogOwnerUuid: "new-owner", catalog: [item("new-branch", "new-owner")], catalogReady: true });
    read.resolve([item()]); save.reject(new Error("Old connection lost"));
    await loading;
    await expect(saving).rejects.toThrow("Old connection lost");
    expect(useCommercialStore.getState()).toMatchObject({ catalogOwnerUuid: "new-owner", catalog: [item("new-branch", "new-owner")], catalogReady: true, error: null, catalogError: null });
  });

  it("does not commit a pending response after auth metadata changes its owner", async () => {
    const pending = deferred<CatalogItem[]>();
    vi.mocked(getCommercialCatalog).mockReturnValueOnce(pending.promise);
    const load = useCommercialStore.getState().loadCatalog();
    useAuthStore.setState({ user: { ...user, store_uuid: "new-owner" } });
    pending.resolve([item()]);
    await load;
    expect(useCommercialStore.getState().catalog).toEqual([]);
  });

  it("ignores late document history, detail and creates after a target change", async () => {
    const history = deferred<CommercialDocument[]>();
    const detail = deferred<CommercialDocument>();
    const create = deferred<CommercialDocument>();
    vi.mocked(getCommercialDocuments).mockReturnValueOnce(history.promise);
    vi.mocked(getCommercialDocument).mockReturnValueOnce(detail.promise);
    vi.mocked(createCommercialDocument).mockReturnValueOnce(create.promise);
    const loading = useCommercialStore.getState().loadDocuments();
    const opening = useCommercialStore.getState().openDocument("document");
    const saving = useCommercialStore.getState().createDocument(input);
    useCommercialStore.getState().selectBranch("b");
    history.resolve([document()]); detail.resolve(document()); create.resolve(document());
    await loading;
    expect(await opening).toBeNull();
    expect(await saving).toBeNull();
    expect(useCommercialStore.getState()).toMatchObject({ branchUuid: "b", documents: [], selectedDocument: null, saving: false });
  });

  it("fetches a fresh document for editing and preserves its saved line snapshots", async () => {
    useCommercialStore.setState({ documents: [document()], selectedDocument: document(), catalog: [{ ...item(), active: false, unit_price: 1 }] });
    const fresh = { ...document(), version: 3, notes: "Latest saved notes" };
    vi.mocked(getCommercialDocument).mockResolvedValueOnce(fresh);
    await useCommercialStore.getState().beginEdit("document");
    expect(getCommercialDocument).toHaveBeenCalledWith("a", "document");
    expect(useCommercialStore.getState()).toMatchObject({ editingDocument: fresh, selectedDocument: null, loading: false });
    expect(useCommercialStore.getState().editingDocument?.items[0]).toMatchObject({ line_uuid: "line-1", unit_price: 950000, image_url: item().image_url });
  });

  it("does not reopen a cancelled or foreign-branch edit preparation", async () => {
    const pending = deferred<CommercialDocument>();
    vi.mocked(getCommercialDocument).mockReturnValueOnce(pending.promise);
    const editing = useCommercialStore.getState().beginEdit("document");
    useCommercialStore.getState().closeEditor();
    pending.resolve(document()); await editing;
    expect(useCommercialStore.getState().editingDocument).toBeNull();
    vi.mocked(getCommercialDocument).mockResolvedValueOnce(document("b"));
    await expect(useCommercialStore.getState().beginEdit("document")).rejects.toThrow("another branch");
    expect(useCommercialStore.getState().editingDocument).toBeNull();
  });

  it("merges an authoritative update without modifying a linked receipt", async () => {
    const quote = { ...document(), receipt_uuid: "receipt" };
    const receipt: CommercialDocument = { ...document(), document_uuid: "receipt", document_type: "receipt", source_quotation_uuid: "document", source_quotation_version: 1 };
    useCommercialStore.setState({ documents: [quote, receipt], editingDocument: quote });
    const updated = { ...quote, version: 2, notes: "Edited quotation", discount_type: "amount" as const, discount_value: 1000, discount_amount: 1000, total: 949000 };
    vi.mocked(updateCommercialDocument).mockResolvedValueOnce(updated);
    expect(await useCommercialStore.getState().updateDocument(updateInput)).toEqual(updated);
    expect(updateCommercialDocument).toHaveBeenCalledWith(updateInput);
    expect(useCommercialStore.getState()).toMatchObject({ selectedDocument: updated, editingDocument: null, saving: false });
    expect(useCommercialStore.getState().documents.find((row) => row.document_uuid === "receipt")).toEqual(receipt);
  });

  it("keeps the loaded editing snapshot and expected version after a conflict", async () => {
    const original = document();
    useCommercialStore.setState({ documents: [original], editingDocument: original });
    vi.mocked(updateCommercialDocument).mockRejectedValueOnce(new ServiceError("Version conflict", 409));
    await expect(useCommercialStore.getState().updateDocument(updateInput)).rejects.toThrow("Version conflict");
    expect(useCommercialStore.getState()).toMatchObject({ editingDocument: original, documents: [original], editConflict: true, saving: false, error: "Version conflict" });
    expect(useCommercialStore.getState().editingDocument).toBe(original);
  });

  it("retries a lost update with the same operation instead of inventing a local version", async () => {
    useCommercialStore.setState({ documents: [document()], editingDocument: document() });
    vi.mocked(updateCommercialDocument).mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce({ ...document(), version: 2 });
    await expect(useCommercialStore.getState().updateDocument(updateInput)).rejects.toThrow("Connection lost");
    expect(useCommercialStore.getState().documents[0].version).toBe(1);
    await useCommercialStore.getState().updateDocument(updateInput);
    expect(vi.mocked(updateCommercialDocument).mock.calls.map(([payload]) => payload.request_uuid)).toEqual(["operation-1", "operation-1"]);
    expect(useCommercialStore.getState().documents[0].version).toBe(2);
  });

  it("does not demote a newer cached version on an idempotent old-revision replay", async () => {
    const newest = { ...document(), version: 4, notes: "A later saved version" };
    useCommercialStore.setState({ documents: [newest], editingDocument: document() });
    vi.mocked(updateCommercialDocument).mockResolvedValueOnce({ ...document(), version: 2 });
    expect(await useCommercialStore.getState().updateDocument(updateInput)).toEqual(newest);
    expect(useCommercialStore.getState()).toMatchObject({ documents: [newest], selectedDocument: newest });
  });

  it("does not demote a fresh detail or editing snapshot when an older list finishes", async () => {
    const pending = deferred<CommercialDocument[]>();
    vi.mocked(getCommercialDocuments).mockReturnValueOnce(pending.promise);
    const list = useCommercialStore.getState().loadDocuments();
    const fresh = { ...document(), version: 3, notes: "Fresh saved content" };
    vi.mocked(getCommercialDocument).mockResolvedValueOnce(fresh);
    await useCommercialStore.getState().beginEdit("document");
    pending.resolve([document()]); await list;
    expect(useCommercialStore.getState()).toMatchObject({ documents: [fresh], editingDocument: fresh, documentsLoading: false });
  });

  it("preserves a permanent receipt link when an equal-version replay predates conversion", async () => {
    useCommercialStore.setState({ documents: [{ ...document(), version: 2, receipt_uuid: "linked-receipt" }] });
    vi.mocked(updateCommercialDocument).mockResolvedValueOnce({ ...document(), version: 2, receipt_uuid: null });
    const saved = await useCommercialStore.getState().updateDocument(updateInput);
    expect(saved?.receipt_uuid).toBe("linked-receipt");
    expect(useCommercialStore.getState().documents[0].receipt_uuid).toBe("linked-receipt");
  });

  it("rejects document-update responses with a wrong identity or branch", async () => {
    vi.mocked(updateCommercialDocument).mockResolvedValueOnce({ ...document(), document_uuid: "foreign" }).mockResolvedValueOnce(document("b"));
    await expect(useCommercialStore.getState().updateDocument(updateInput)).rejects.toThrow("another document");
    await expect(useCommercialStore.getState().updateDocument(updateInput)).rejects.toThrow("another branch");
    expect(useCommercialStore.getState().documents).toEqual([]);
  });

  it("ignores late updates after a branch change or logout", async () => {
    const pending = deferred<CommercialDocument>();
    vi.mocked(updateCommercialDocument).mockReturnValueOnce(pending.promise);
    const update = useCommercialStore.getState().updateDocument(updateInput);
    useCommercialStore.getState().selectBranch("b");
    pending.resolve({ ...document(), version: 2 });
    expect(await update).toBeNull();
    expect(useCommercialStore.getState()).toMatchObject({ branchUuid: "b", documents: [], selectedDocument: null, editingDocument: null });
    useCommercialStore.setState({ branchUuid: "a", branches });
    const oldSession = deferred<CommercialDocument>();
    vi.mocked(updateCommercialDocument).mockReturnValueOnce(oldSession.promise);
    const oldUpdate = useCommercialStore.getState().updateDocument(updateInput);
    resetSessionStores(); oldSession.resolve({ ...document(), version: 2 });
    expect(await oldUpdate).toBeNull();
    expect(useCommercialStore.getState().documents).toEqual([]);
  });

  it("loads only matching read-only revision snapshots and cancels late results", async () => {
    const revision: CommercialDocumentRevision = { version: 1, request_uuid: null, changed_at: "2026-11-14", changed_by: "operator", snapshot: document() };
    vi.mocked(getCommercialDocumentRevisions).mockResolvedValueOnce([revision]);
    await useCommercialStore.getState().openRevisions("document");
    expect(useCommercialStore.getState()).toMatchObject({ revisions: [revision], revisionsLoading: false });
    vi.mocked(getCommercialDocumentRevisions).mockResolvedValueOnce([{ ...revision, snapshot: document("b") }]);
    await expect(useCommercialStore.getState().openRevisions("document")).rejects.toThrow("another branch");
    expect(useCommercialStore.getState().revisions).toEqual([]);
    const pending = deferred<CommercialDocumentRevision[]>();
    vi.mocked(getCommercialDocumentRevisions).mockReturnValueOnce(pending.promise);
    const load = useCommercialStore.getState().openRevisions("document");
    useCommercialStore.getState().closeRevisions(); pending.resolve([revision]); await load;
    expect(useCommercialStore.getState()).toMatchObject({ revisions: [], revisionDocumentUuid: null });
  });
});
