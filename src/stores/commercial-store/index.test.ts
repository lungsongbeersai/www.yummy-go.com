import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBranchManagementStoreOptions, getBranchOptions } from "@/services/branch";
import { createCommercialDocument, getCommercialCatalog, getCommercialDocument, getCommercialDocumentRevision, getCommercialDocumentRevisions, getCommercialDocuments, getCommercialPaymentProfiles, saveCommercialPaymentProfile, saveCommercialPaymentProfiles, saveCatalogItem, updateCommercialDocument, type CatalogItem, type CommercialDocument, type CommercialDocumentRevision, type CommercialPaymentProfile, type CreateCommercialDocumentInput, type UpdateCommercialDocumentInput } from "@/services/commercial";
import { ServiceError } from "@/lib/api";
import { commercialLineInput, newCommercialLine } from "@/features/commercial/commercial-domain";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useCommercialStore } from "@/stores/commercial-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/branch", () => ({ getBranchManagementStoreOptions: vi.fn(), getBranchOptions: vi.fn() }));
vi.mock("@/services/commercial", () => ({ getCommercialPaymentProfiles: vi.fn(), saveCommercialPaymentProfile: vi.fn(), saveCommercialPaymentProfiles: vi.fn(), getCommercialCatalog: vi.fn(), getCommercialDocuments: vi.fn(), getCommercialDocument: vi.fn(), getCommercialDocumentRevision: vi.fn(), getCommercialDocumentRevisions: vi.fn(), updateCommercialDocument: vi.fn(), saveCatalogItem: vi.fn(), createCommercialDocument: vi.fn(), convertQuotation: vi.fn() }));

const user: AuthUser = { uuid: "user", email: "test@example.test", status: 2, store_status: 1, profile: "", branch_uuid: "a", branch_name: "A", branch_tel: "", branch_address: "", store_uuid: "store", store_name: "Store", store_logo: "", store_table_status: 1 };
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
const paymentProfile: CommercialPaymentProfile = { profile_uuid: "profile", label: "Private", bank_name: "Bank", account_name: "Owner", account_number: "001234", currency: "LAK", qr_image: "data:image/png;base64,QUJD" };
const profileInput = { label: "Private", bank_name: "Bank", account_name: "Owner", account_number: "001234", currency: "LAK" as const };

function paymentDocument(version = 1, hydrated = true): CommercialDocument {
  return { ...document(), version, payment_details: { show_accounts: true, show_qr: true, accounts: [{ snapshot_uuid: `snapshot-v${version}`, profile_uuid: "profile", label: "Private", bank_name: "Bank", account_name: "Owner", account_number: "001234", currency: "LAK", has_qr: true, ...(hydrated ? { qr_image: "data:image/png;base64,QUJD" } : {}) }] } };
}

function document(branchUuid = "a"): CommercialDocument {
  return { ...input, payment_details: undefined, version: 1, updated_at: "2026-11-14", updated_by: "operator", discount_type: null, discount_value: 0, discount_amount: 0, source_quotation_version: null, branch_uuid: branchUuid, document_uuid: "document", number: "QT-1", valid_until: null, notes: "", payment_method: "", subtotal: 950000, tax_amount: 0, total: 950000, source_quotation_uuid: null, receipt_uuid: null, created_at: "2026-11-14", items: [{ line_uuid: "line-1", item_uuid: "item", name: "Printer", quantity: 1, unit_price: 950000, line_total: 950000, image_url: item().image_url, show_image: true }] };
}

describe("commercial request scope ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useCommercialStore.getState().reset();
    useAuthStore.setState({ user, token: "session-token" });
    useCommercialStore.setState({ catalogOwnerUuid: "store", storeUuid: "store", branchUuid: "a", branches });
  });

  it("clears all commercial snapshots and drops pending reads/writes across PLC revocation and return with the same actor/token", async () => {
    const catalog = deferred<CatalogItem[]>();
    const profiles = deferred<CommercialPaymentProfile[]>();
    const detail = deferred<CommercialDocument>();
    const issuing = deferred<CommercialDocument>();
    const profileWrite = deferred<CommercialPaymentProfile[]>();
    vi.mocked(getCommercialCatalog).mockReturnValueOnce(catalog.promise);
    vi.mocked(getCommercialPaymentProfiles).mockReturnValueOnce(profiles.promise);
    vi.mocked(getCommercialDocument).mockReturnValueOnce(detail.promise);
    vi.mocked(createCommercialDocument).mockReturnValueOnce(issuing.promise);
    vi.mocked(saveCommercialPaymentProfiles).mockReturnValueOnce(profileWrite.promise);
    useCommercialStore.setState({ catalog: [item()], catalogReady: true, documents: [paymentDocument()], selectedDocument: paymentDocument(), editingDocument: paymentDocument(), revisions: [{ version: 1, request_uuid: null, changed_at: "2026-11-14", changed_by: "operator", snapshot: paymentDocument() }], revisionSnapshot: paymentDocument(), paymentProfiles: [paymentProfile] });
    const readingCatalog = useCommercialStore.getState().loadCatalog();
    const readingProfiles = useCommercialStore.getState().loadPaymentProfiles();
    const readingDocument = useCommercialStore.getState().openDocument("document");
    const creating = useCommercialStore.getState().createDocument(input);
    const savingProfiles = useCommercialStore.getState().savePaymentProfiles([{ ...profileInput, profile_uuid: "profile" }]);

    useAuthStore.getState().updateUser({ store_status: 2 });
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [], documents: [], selectedDocument: null, editingDocument: null, revisions: [], revisionSnapshot: null, paymentProfiles: [], branchUuid: "", storeUuid: "" });
    useAuthStore.getState().updateUser({ store_status: 1 });
    // A fresh authorized scope may already be active before the old requests finish.
    useCommercialStore.setState({ catalogOwnerUuid: "store", storeUuid: "store", branchUuid: "a", branches });
    catalog.resolve([item()]); profiles.resolve([paymentProfile]); detail.resolve(document()); issuing.resolve(document()); profileWrite.resolve([paymentProfile]);
    await Promise.all([readingCatalog, readingProfiles, readingDocument]);
    expect(await creating).toBeNull();
    expect(await savingProfiles).toBeNull();
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [], catalogReady: false, documents: [], selectedDocument: null, editingDocument: null, paymentProfiles: [], paymentProfilesReady: false, saving: false });
    vi.mocked(getCommercialCatalog).mockResolvedValueOnce([item()]);
    vi.mocked(getCommercialPaymentProfiles).mockResolvedValueOnce([paymentProfile]);
    await Promise.all([useCommercialStore.getState().loadCatalog(), useCommercialStore.getState().loadPaymentProfiles()]);
    expect(useCommercialStore.getState()).toMatchObject({ catalog: [item()], paymentProfiles: [paymentProfile] });
  });

  it("keeps private profiles reusable across selected target branches and customer stores", async () => {
    vi.mocked(getCommercialPaymentProfiles).mockResolvedValueOnce([paymentProfile]);
    await useCommercialStore.getState().loadPaymentProfiles();
    useCommercialStore.getState().selectBranch("b");
    useCommercialStore.setState({ stores: [{ store_uuid: "store" }, { store_uuid: "customer-store" }] });
    vi.mocked(getBranchOptions).mockResolvedValueOnce([{ branch_uuid: "customer-branch", store_uuid_fk: "customer-store" }]);
    await useCommercialStore.getState().selectStore("customer-store", "customer-branch");
    expect(useCommercialStore.getState()).toMatchObject({ paymentOwnerUuid: "user:store", paymentProfiles: [paymentProfile], paymentProfilesReady: true });
    expect(getCommercialPaymentProfiles).toHaveBeenCalledWith();
  });

  it("clears private numbers and QR immediately when another user in the same store signs in", async () => {
    vi.mocked(getCommercialPaymentProfiles).mockResolvedValueOnce([paymentProfile]);
    await useCommercialStore.getState().loadPaymentProfiles();
    useAuthStore.setState({ user: { ...user, uuid: "another-user" } });
    expect(useCommercialStore.getState()).toMatchObject({ paymentOwnerUuid: "", paymentProfiles: [], paymentProfilesReady: false, paymentProfilesError: null });
  });

  it.each(["user", "store", "token"])("ignores private profile reads and writes after the authenticated %s changes", async (identity) => {
    const read = deferred<CommercialPaymentProfile[]>();
    const write = deferred<CommercialPaymentProfile>();
    vi.mocked(getCommercialPaymentProfiles).mockReturnValueOnce(read.promise);
    vi.mocked(saveCommercialPaymentProfile).mockReturnValueOnce(write.promise);
    const reading = useCommercialStore.getState().loadPaymentProfiles();
    const saving = useCommercialStore.getState().savePaymentProfile(profileInput);
    if (identity === "token") useAuthStore.setState({ token: "different-session-token" });
    else useAuthStore.setState({ user: { ...user, ...(identity === "user" ? { uuid: "another-user" } : { store_uuid: "another-store" }) } });
    read.resolve([paymentProfile]); write.resolve(paymentProfile);
    await reading;
    expect(await saving).toBeNull();
    expect(useCommercialStore.getState()).toMatchObject({ paymentProfiles: [], paymentProfilesLoading: false, paymentProfilesSaving: false, paymentOwnerUuid: "" });
  });

  it("clears private profiles on logout or authenticated store reassignment", async () => {
    vi.mocked(getCommercialPaymentProfiles).mockResolvedValue([paymentProfile]);
    await useCommercialStore.getState().loadPaymentProfiles();
    useAuthStore.setState({ user: { ...user, store_uuid: "another-authenticated-store" } });
    expect(useCommercialStore.getState().paymentProfiles).toEqual([]);
    await useCommercialStore.getState().loadPaymentProfiles();
    resetSessionStores();
    expect(useCommercialStore.getState()).toMatchObject({ paymentProfiles: [], paymentProfilesReady: false });
  });

  it("prevents an older private profile read from erasing a saved QR edit", async () => {
    const pending = deferred<CommercialPaymentProfile[]>();
    vi.mocked(getCommercialPaymentProfiles).mockReturnValueOnce(pending.promise);
    const read = useCommercialStore.getState().loadPaymentProfiles();
    const edited = { ...paymentProfile, account_number: "Saved new account" };
    vi.mocked(saveCommercialPaymentProfile).mockResolvedValueOnce(edited);
    expect(await useCommercialStore.getState().savePaymentProfile(profileInput)).toEqual(edited);
    pending.resolve([]); await read;
    expect(useCommercialStore.getState().paymentProfiles).toEqual([edited]);
  });

  it("allows a branch administrator to save only their private payment profiles without a target branch", async () => {
    useAuthStore.setState({ user: { ...user, status: 3 } });
    useCommercialStore.setState({ branchUuid: "", branches: [] });
    vi.mocked(saveCommercialPaymentProfile).mockResolvedValueOnce(paymentProfile);
    expect(await useCommercialStore.getState().savePaymentProfile(profileInput)).toEqual(paymentProfile);
    expect(useCommercialStore.getState().documents).toEqual([]);
  });

  it("merges a saved account batch once and prevents an older read from erasing it", async () => {
    const read = deferred<CommercialPaymentProfile[]>();
    vi.mocked(getCommercialPaymentProfiles).mockReturnValueOnce(read.promise);
    const loading = useCommercialStore.getState().loadPaymentProfiles();
    const rows = [paymentProfile, { ...paymentProfile, profile_uuid: "second", currency: "THB" as const }];
    const inputs = rows.map((row) => ({ ...profileInput, profile_uuid: row.profile_uuid, currency: row.currency }));
    vi.mocked(saveCommercialPaymentProfiles).mockResolvedValue(rows);
    expect(await useCommercialStore.getState().savePaymentProfiles(inputs)).toEqual(rows);
    read.resolve([]); await loading;
    await useCommercialStore.getState().savePaymentProfiles(inputs);
    expect(useCommercialStore.getState().paymentProfiles).toEqual(rows);
    expect(useCommercialStore.getState().documents).toEqual([]);
  });

  it.each(["user", "store", "token"])("discards a private account batch after the authenticated %s changes", async (identity) => {
    const response = deferred<CommercialPaymentProfile[]>();
    vi.mocked(saveCommercialPaymentProfiles).mockReturnValueOnce(response.promise);
    const saving = useCommercialStore.getState().savePaymentProfiles([{ ...profileInput, profile_uuid: "profile" }]);
    if (identity === "token") useAuthStore.setState({ token: "new-batch-session" });
    else useAuthStore.setState({ user: { ...user, ...(identity === "user" ? { uuid: "new-user" } : { store_uuid: "new-store" }) } });
    response.resolve([paymentProfile]);
    expect(await saving).toBeNull();
    expect(useCommercialStore.getState()).toMatchObject({ paymentProfiles: [], paymentProfilesSaving: false, paymentOwnerUuid: "" });
  });

  it("retains saved profiles and reports a failed or mismatched account batch without a partial local success", async () => {
    vi.mocked(getCommercialPaymentProfiles).mockResolvedValueOnce([paymentProfile]);
    await useCommercialStore.getState().loadPaymentProfiles();
    const inputs = [{ ...profileInput, profile_uuid: "new-profile" }];
    vi.mocked(saveCommercialPaymentProfiles).mockRejectedValueOnce(new ServiceError("Batch rejected", 422));
    await expect(useCommercialStore.getState().savePaymentProfiles(inputs)).rejects.toThrow("Batch rejected");
    expect(useCommercialStore.getState()).toMatchObject({ paymentProfiles: [paymentProfile], paymentProfilesSaving: false, paymentProfilesError: "Batch rejected" });
    vi.mocked(saveCommercialPaymentProfiles).mockResolvedValueOnce([paymentProfile]);
    await expect(useCommercialStore.getState().savePaymentProfiles(inputs)).rejects.toThrow("do not match");
    expect(useCommercialStore.getState().paymentProfiles).toEqual([paymentProfile]);
  });

  it("preserves hydrated same-version QR data when a document list summary finishes later", async () => {
    useCommercialStore.setState({ documents: [paymentDocument()] });
    vi.mocked(getCommercialDocuments).mockResolvedValueOnce([paymentDocument(1, false)]);
    await useCommercialStore.getState().loadDocuments();
    expect(useCommercialStore.getState().documents[0].payment_details?.accounts[0].qr_image).toBe(paymentProfile.qr_image);
  });

  it("hydrates a newer cached summary before presenting an older full read as an editable document", async () => {
    useCommercialStore.setState({ documents: [paymentDocument(2, false)] });
    vi.mocked(getCommercialDocument).mockResolvedValueOnce(paymentDocument(1)).mockResolvedValueOnce(paymentDocument(2));
    await useCommercialStore.getState().beginEdit("document");
    expect(getCommercialDocument).toHaveBeenCalledTimes(2);
    expect(useCommercialStore.getState().editingDocument).toEqual(paymentDocument(2));
  });

  it("fails visibly if the latest version still lacks its authorized QR after hydration", async () => {
    useCommercialStore.setState({ documents: [paymentDocument(2, false)] });
    vi.mocked(getCommercialDocument).mockResolvedValueOnce(paymentDocument(1)).mockResolvedValueOnce(paymentDocument(2, false));
    await expect(useCommercialStore.getState().openDocument("document")).rejects.toThrow("latest document details");
    expect(useCommercialStore.getState().selectedDocument).toBeNull();
  });

  it("hydrates the requested historical version and rejects mismatched or closed revision requests", async () => {
    useCommercialStore.setState({ revisionDocumentUuid: "document" });
    const revision = { version: 1, request_uuid: null, changed_at: "2026-11-14", changed_by: "operator", snapshot: paymentDocument(1) };
    vi.mocked(getCommercialDocumentRevision).mockResolvedValueOnce(revision);
    await useCommercialStore.getState().openRevision(1);
    expect(getCommercialDocumentRevision).toHaveBeenCalledWith("a", "document", 1);
    expect(useCommercialStore.getState().revisionSnapshot).toEqual(revision.snapshot);
    vi.mocked(getCommercialDocumentRevision).mockResolvedValueOnce({ ...revision, snapshot: paymentDocument(2) });
    await expect(useCommercialStore.getState().openRevision(1)).rejects.toThrow("requested document version");
    const pending = deferred<CommercialDocumentRevision>();
    vi.mocked(getCommercialDocumentRevision).mockReturnValueOnce(pending.promise);
    const read = useCommercialStore.getState().openRevision(1);
    useCommercialStore.getState().closeRevisions(); pending.resolve(revision); await read;
    expect(useCommercialStore.getState()).toMatchObject({ revisionSnapshot: null, revisionSnapshotLoading: false });
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

  it("clears route-only state while retaining the verified scope and shared catalogue", () => {
    useCommercialStore.setState({ catalog: [item()], catalogReady: true, selectedDocument: document(), editingDocument: document(), editConflict: true, error: "Old error" });
    useCommercialStore.getState().enterRoute();
    expect(useCommercialStore.getState()).toMatchObject({ storeUuid: "store", branchUuid: "a", branches, catalog: [item()], catalogReady: true, selectedDocument: null, editingDocument: null, editConflict: false, error: null });
  });

  it("does not let an older page cleanup clear a newer route's state", () => {
    const oldLease = useCommercialStore.getState().enterRoute();
    useCommercialStore.getState().enterRoute();
    useCommercialStore.setState({ selectedDocument: document(), error: "Current route error" });
    useCommercialStore.getState().leaveRoute(oldLease);
    expect(useCommercialStore.getState()).toMatchObject({ selectedDocument: document(), error: "Current route error", branchUuid: "a" });
  });

  it("ignores stale details and edits after navigation within the same branch", async () => {
    useCommercialStore.getState().enterRoute();
    const detail = deferred<CommercialDocument>();
    const editing = deferred<CommercialDocument>();
    vi.mocked(getCommercialDocument).mockReturnValueOnce(detail.promise).mockReturnValueOnce(editing.promise);
    const opening = useCommercialStore.getState().openDocument("document");
    const preparing = useCommercialStore.getState().beginEdit("document");
    useCommercialStore.getState().enterRoute();
    detail.resolve(document()); editing.resolve(document());
    expect(await opening).toBeNull(); await preparing;
    expect(useCommercialStore.getState()).toMatchObject({ selectedDocument: null, editingDocument: null, loading: false, branchUuid: "a" });
  });

  it("does not reopen an old result after leaving a page with a pending save", async () => {
    const lease = useCommercialStore.getState().enterRoute();
    const pending = deferred<CommercialDocument>();
    vi.mocked(updateCommercialDocument).mockReturnValueOnce(pending.promise);
    const saving = useCommercialStore.getState().updateDocument(updateInput);
    useCommercialStore.getState().leaveRoute(lease);
    useCommercialStore.getState().enterRoute();
    pending.resolve({ ...document(), version: 2 });
    expect(await saving).toBeNull();
    expect(useCommercialStore.getState()).toMatchObject({ selectedDocument: null, editingDocument: null, saving: false, branchUuid: "a" });
  });
});
