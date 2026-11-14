import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBranchManagementStoreOptions, getBranchOptions } from "@/services/branch";
import { createCommercialDocument, getCommercialCatalog, getCommercialDocument, getCommercialDocuments, saveCatalogItem, type CatalogItem, type CommercialDocument, type CreateCommercialDocumentInput } from "@/services/commercial";
import { commercialLineInput, newCommercialLine } from "@/features/commercial/commercial-domain";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useCommercialStore } from "@/stores/commercial-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/branch", () => ({ getBranchManagementStoreOptions: vi.fn(), getBranchOptions: vi.fn() }));
vi.mock("@/services/commercial", () => ({ getCommercialCatalog: vi.fn(), getCommercialDocuments: vi.fn(), getCommercialDocument: vi.fn(), saveCatalogItem: vi.fn(), createCommercialDocument: vi.fn(), convertQuotation: vi.fn() }));

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

function document(branchUuid = "a"): CommercialDocument {
  return { ...input, branch_uuid: branchUuid, document_uuid: "document", number: "QT-1", valid_until: null, notes: "", payment_method: "", subtotal: 950000, tax_amount: 0, total: 950000, source_quotation_uuid: null, receipt_uuid: null, created_at: "2026-11-14", items: [{ item_uuid: "item", name: "Printer", quantity: 1, unit_price: 950000, line_total: 950000, image_url: item().image_url, show_image: true }] };
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
});
