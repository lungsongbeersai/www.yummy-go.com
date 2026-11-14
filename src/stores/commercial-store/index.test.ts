import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBranchManagementStoreOptions, getBranchOptions } from "@/services/branch";
import { createCommercialDocument, getCommercialCatalog, saveCatalogItem, type CatalogItem, type CommercialDocument, type CreateCommercialDocumentInput } from "@/services/commercial";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useCommercialStore } from "@/stores/commercial-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/branch", () => ({ getBranchManagementStoreOptions: vi.fn(), getBranchOptions: vi.fn() }));
vi.mock("@/services/commercial", () => ({ getCommercialCatalog: vi.fn(), getCommercialDocuments: vi.fn(), getCommercialDocument: vi.fn(), saveCatalogItem: vi.fn(), createCommercialDocument: vi.fn(), convertQuotation: vi.fn() }));

const user: AuthUser = { uuid: "user", email: "test@example.test", status: 2, profile: "", branch_uuid: "a", branch_name: "A", branch_tel: "", branch_address: "", store_uuid: "store", store_name: "Store", store_logo: "", store_table_status: 1 };
const branches = [{ branch_uuid: "a", store_uuid_fk: "store" }, { branch_uuid: "b", store_uuid_fk: "store" }];

function item(branchUuid = "a"): CatalogItem {
  return { item_uuid: "item", branch_uuid: branchUuid, name: "Printer", description: "", unit: "unit", unit_price: 950000, image_url: null, image_visible: true, active: true, created_at: "2026-11-14", updated_at: "2026-11-14" };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const input: CreateCommercialDocumentInput = { branch_uuid: "a", document_type: "quotation", issued_on: "2026-11-14", customer: { name: "Customer" }, issuer: { name: "PLC" }, show_images: true, tax_rate: 0, items: [{ name: "Printer", quantity: 1, unit_price: 950000 }] };

function document(): CommercialDocument {
  return { ...input, document_uuid: "document", number: "QT-1", valid_until: null, notes: "", payment_method: "", subtotal: 950000, tax_amount: 0, total: 950000, source_quotation_uuid: null, receipt_uuid: null, created_at: "2026-11-14", items: [{ item_uuid: null, name: "Printer", quantity: 1, unit_price: 950000, line_total: 950000, image_url: null, show_image: false }] };
}

describe("commercial request scope ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useCommercialStore.getState().reset();
    useAuthStore.setState({ user });
    useCommercialStore.setState({ storeUuid: "store", branchUuid: "a", branches });
  });

  it("ignores a catalog response after selecting another branch", async () => {
    const pending = deferred<CatalogItem[]>();
    vi.mocked(getCommercialCatalog).mockReturnValueOnce(pending.promise);
    const load = useCommercialStore.getState().loadCatalog();
    useCommercialStore.getState().selectBranch("b");
    pending.resolve([item("a")]);
    await load;
    expect(useCommercialStore.getState()).toMatchObject({ branchUuid: "b", catalog: [], catalogLoading: false });
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

  it("rejects a response from another branch", async () => {
    vi.mocked(saveCatalogItem).mockResolvedValueOnce(item("b"));
    await expect(useCommercialStore.getState().saveItem({ branch_uuid: "a", name: "Printer", unit_price: 950000, active: true, image_visible: true })).rejects.toThrow("another branch");
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [], saving: false });
  });

  it("resolves unauthorized store/branch deep links to the authenticated scope", async () => {
    useAuthStore.setState({ user: { ...user, status: 3 } });
    vi.mocked(getBranchManagementStoreOptions).mockResolvedValueOnce({ status: "success", message: "", data: [{ store_uuid: "store" }], scope: { can_select_store: false, store_uuid: "store" } });
    vi.mocked(getBranchOptions).mockResolvedValueOnce(branches);
    await useCommercialStore.getState().initialize({ storeUuid: "foreign", branchUuid: "b" });
    expect(getBranchOptions).toHaveBeenCalledWith("store");
    expect(useCommercialStore.getState()).toMatchObject({ storeUuid: "store", branchUuid: "a", branches: [branches[0]], optionsLoading: false });
  });
});
