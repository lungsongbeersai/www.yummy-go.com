import type { CommercialPaymentAccountSnapshot, CommercialPaymentDetails, CommercialPaymentDetailsInput, CommercialPaymentProfile } from "@/services/commercial";

export interface CommercialPaymentDraft {
  show_accounts: boolean;
  show_qr: boolean;
  accounts: CommercialPaymentAccountSnapshot[];
}

export function commercialPaymentDraft(details?: CommercialPaymentDetails, legacyBankDetails?: string): CommercialPaymentDraft {
  return { show_accounts: details?.show_accounts ?? Boolean(legacyBankDetails?.trim()), show_qr: details?.show_qr ?? false,
    accounts: details?.accounts.map((account) => ({ ...account })) ?? [] };
}

export function commercialPaymentProfileSnapshot(profile: CommercialPaymentProfile): CommercialPaymentAccountSnapshot {
  return { snapshot_uuid: "", profile_uuid: profile.profile_uuid, label: profile.label, bank_name: profile.bank_name,
    account_name: profile.account_name, account_number: profile.account_number, currency: profile.currency, qr_image: profile.qr_image };
}

export function commercialPaymentInput(draft: CommercialPaymentDraft): CommercialPaymentDetailsInput {
  return { show_accounts: draft.show_accounts, show_qr: draft.show_qr,
    accounts: draft.show_accounts || draft.show_qr ? draft.accounts.map((account) => account.snapshot_uuid
      ? { snapshot_uuid: account.snapshot_uuid }
      : { profile_uuid: account.profile_uuid ?? undefined }) : [] };
}

/** Hidden payment fields never enter the shared document preview snapshot. */
export function commercialPaymentPreview(draft: CommercialPaymentDraft): CommercialPaymentDetails {
  return { ...draft, accounts: draft.show_accounts || draft.show_qr ? draft.accounts.map((account) => ({
    snapshot_uuid: account.snapshot_uuid, profile_uuid: account.profile_uuid, label: account.label,
    bank_name: account.bank_name, account_name: account.account_name, currency: account.currency,
    ...(draft.show_accounts && account.account_number ? { account_number: account.account_number } : {}),
    ...(draft.show_qr && account.qr_image ? { qr_image: account.qr_image } : {}),
  })) : [] };
}

export function validCommercialPaymentDetails(details?: CommercialPaymentDetailsInput, legacyBankDetails?: string) {
  if (!details) return true;
  if (typeof details.show_accounts !== "boolean" || typeof details.show_qr !== "boolean" || details.accounts.length > 3) return false;
  if ((details.show_qr || (details.show_accounts && !legacyBankDetails?.trim())) && !details.accounts.length) return false;
  const identities = details.accounts.map((account) => account.snapshot_uuid ? `snapshot:${account.snapshot_uuid}` : account.profile_uuid ? `profile:${account.profile_uuid}` : "");
  return identities.every(Boolean) && new Set(identities).size === identities.length;
}

export function validCommercialPaymentDraft(draft: CommercialPaymentDraft, legacyBankDetails?: string) {
  return validCommercialPaymentDetails(commercialPaymentInput(draft), legacyBankDetails) &&
    (!draft.show_accounts || draft.accounts.every((account) => Boolean(account.account_number?.trim()))) &&
    (!draft.show_qr || draft.accounts.some((account) => Boolean(account.qr_image)));
}
