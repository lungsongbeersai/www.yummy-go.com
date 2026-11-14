import { describe, expect, it } from "vitest";
import { commercialPaymentDraft, commercialPaymentInput, commercialPaymentPreview, commercialPaymentProfileSnapshot, validCommercialPaymentDetails, validCommercialPaymentDraft } from "@/features/commercial/commercial-payment";
import type { CommercialPaymentProfile } from "@/services/commercial";

const profile: CommercialPaymentProfile = { profile_uuid: "private-profile", label: "Main account", bank_name: "Bank", account_name: "Private owner", account_number: "001-234", currency: "LAK", qr_image: "data:image/png;base64,QUJD" };

describe("commercial payment opt-in snapshots", () => {
  it("defaults new documents off and preserves explicit legacy bank visibility", () => {
    expect(commercialPaymentDraft()).toEqual({ show_accounts: false, show_qr: false, accounts: [] });
    expect(commercialPaymentDraft(undefined, "Old bank details").show_accounts).toBe(true);
    expect(commercialPaymentDraft({ show_accounts: false, show_qr: false, accounts: [] }, "Old bank details").show_accounts).toBe(false);
  });

  it("sends only selected references and strips every reference while both flags are off", () => {
    const account = commercialPaymentProfileSnapshot(profile);
    const draft = { show_accounts: false, show_qr: false, accounts: [account] };
    expect(commercialPaymentInput(draft)).toEqual({ show_accounts: false, show_qr: false, accounts: [] });
    const input = commercialPaymentInput({ ...draft, show_accounts: true });
    expect(input.accounts).toEqual([{ profile_uuid: profile.profile_uuid }]);
    expect(JSON.stringify(input)).not.toContain(profile.account_number);
    expect(JSON.stringify(input)).not.toContain(profile.qr_image);
    expect(draft.accounts[0]).toEqual(account);
  });

  it("includes only opted-in fields in the shared document preview", () => {
    const draft = { show_accounts: true, show_qr: false, accounts: [commercialPaymentProfileSnapshot(profile)] };
    expect(commercialPaymentPreview(draft).accounts[0]).toMatchObject({ account_number: "001-234" });
    expect(commercialPaymentPreview(draft).accounts[0]).not.toHaveProperty("qr_image");
    const qrOnly = commercialPaymentPreview({ ...draft, show_accounts: false, show_qr: true });
    expect(qrOnly.accounts[0]).toMatchObject({ qr_image: profile.qr_image });
    expect(qrOnly.accounts[0]).not.toHaveProperty("account_number");
    expect(commercialPaymentPreview({ ...draft, show_accounts: false }).accounts).toEqual([]);
  });

  it("retains a saved document identity and never refreshes it from a changed private profile", () => {
    const original = { show_accounts: true, show_qr: true, accounts: [{ ...commercialPaymentProfileSnapshot(profile), snapshot_uuid: "saved-snapshot" }] };
    const draft = commercialPaymentDraft(original);
    profile.account_number = "New number";
    expect(draft.accounts[0].account_number).toBe("001-234");
    expect(commercialPaymentInput(draft).accounts).toEqual([{ snapshot_uuid: "saved-snapshot" }]);
    draft.accounts[0].label = "Draft label";
    expect(original.accounts[0].label).toBe("Main account");
    profile.account_number = "001-234";
  });

  it("requires a visible selected account or explicit legacy bank text and a selected QR", () => {
    const none = commercialPaymentDraft();
    expect(validCommercialPaymentDraft({ ...none, show_accounts: true })).toBe(false);
    expect(validCommercialPaymentDraft({ ...none, show_accounts: true }, "Legacy bank")).toBe(true);
    expect(validCommercialPaymentDraft({ ...none, show_qr: true }, "Legacy bank")).toBe(false);
    const accountOnly = { ...commercialPaymentProfileSnapshot(profile), qr_image: undefined };
    expect(validCommercialPaymentDraft({ show_accounts: true, show_qr: true, accounts: [accountOnly] })).toBe(false);
    expect(validCommercialPaymentDraft({ show_accounts: true, show_qr: true, accounts: [commercialPaymentProfileSnapshot(profile)] })).toBe(true);
  });

  it("cannot add previously omitted private data by retaining a QR-only or account-only snapshot", () => {
    const qrOnly = commercialPaymentDraft({ show_accounts: false, show_qr: true, accounts: [{ ...commercialPaymentProfileSnapshot(profile), snapshot_uuid: "qr-only", account_number: undefined }] });
    expect(validCommercialPaymentDraft({ ...qrOnly, show_accounts: true })).toBe(false);
    expect(validCommercialPaymentDraft({ ...qrOnly, show_accounts: true, accounts: [...qrOnly.accounts, commercialPaymentProfileSnapshot(profile)] })).toBe(false);
    expect(validCommercialPaymentDraft({ ...qrOnly, show_accounts: true }, "Legacy bank text")).toBe(false);
    const accountOnly = commercialPaymentDraft({ show_accounts: true, show_qr: false, accounts: [{ ...commercialPaymentProfileSnapshot(profile), snapshot_uuid: "account-only", qr_image: undefined }] });
    expect(validCommercialPaymentDraft({ ...accountOnly, show_qr: true })).toBe(false);
  });

  it("rejects duplicate, unidentified or more than three account references", () => {
    const flags = { show_accounts: true, show_qr: false };
    expect(validCommercialPaymentDetails({ ...flags, accounts: [{ profile_uuid: "a" }, { profile_uuid: "a" }] })).toBe(false);
    expect(validCommercialPaymentDetails({ ...flags, accounts: [{}] })).toBe(false);
    expect(validCommercialPaymentDetails({ ...flags, accounts: ["a", "b", "c", "d"].map((id) => ({ profile_uuid: id })) })).toBe(false);
    expect(validCommercialPaymentDetails({ ...flags, accounts: ["a", "b", "c"].map((id) => ({ profile_uuid: id })) })).toBe(true);
  });
});
