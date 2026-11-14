import type { Branch, BranchManagementStoreOptions } from "@/services/branch";
import type { CommercialDocument } from "@/services/commercial";
import { ROLE_STATUS } from "@/lib/permissions";

export function commercialStores(options: BranchManagementStoreOptions) {
  const seen = new Set<string>();
  return options.data.filter((store) => {
    const id = store.store_uuid?.trim();
    if (!id || seen.has(id) || (!options.scope.can_select_store && id !== options.scope.store_uuid)) return false;
    seen.add(id);
    return true;
  });
}

export function commercialBranches(branches: Branch[], storeUuid: string, status: number, ownBranchUuid: string) {
  return branches.filter((branch) =>
    branch.branch_uuid && branch.store_uuid_fk === storeUuid &&
    (status !== ROLE_STATUS.BRANCH_ADMIN || branch.branch_uuid === ownBranchUuid),
  );
}

export function commercialBranchRows<T extends CommercialDocument>(rows: T[], branchUuid: string) {
  return rows.filter((row) => Boolean(branchUuid) && row.branch_uuid === branchUuid);
}

export function newestCommercialDocument(rows: CommercialDocument[], incoming: CommercialDocument) {
  let latest = incoming;
  let receiptUuid = incoming.receipt_uuid;
  for (const row of rows) {
    if (row.document_uuid !== incoming.document_uuid) continue;
    if (row.version > latest.version) latest = row;
    if (row.version === latest.version && row.payment_details?.show_qr && latest.payment_details?.show_qr) {
      const hydrated = row.payment_details.accounts;
      latest = { ...latest, payment_details: { ...latest.payment_details, accounts: latest.payment_details.accounts.map((account) => {
        const saved = hydrated.find((candidate) => candidate.snapshot_uuid === account.snapshot_uuid);
        return !account.qr_image && account.has_qr && saved?.qr_image ? { ...account, qr_image: saved.qr_image } : account;
      }) } };
    }
    receiptUuid ||= row.receipt_uuid;
  }
  // Receipt conversion adds a permanent link without changing quote version.
  return !latest.receipt_uuid && receiptUuid ? { ...latest, receipt_uuid: receiptUuid } : latest;
}

export function commercialDocumentNeedsHydration(document: CommercialDocument) {
  return document.payment_details?.show_qr && document.payment_details.accounts.some((account) => account.has_qr && !account.qr_image);
}

export function mergeCommercialDocument(rows: CommercialDocument[], incoming: CommercialDocument) {
  return [newestCommercialDocument(rows, incoming), ...rows.filter((row) => row.document_uuid !== incoming.document_uuid)];
}
