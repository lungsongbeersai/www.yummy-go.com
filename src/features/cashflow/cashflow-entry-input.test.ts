import { describe, expect, it } from "vitest";
import type { CashflowCategory, CashflowEntry } from "@/services/cashflow";
import { cashflowEntryNote, compactCashflowEntryInput } from "./cashflow-entry-input";

const category: CashflowCategory = { category_uuid: "category", branch_uuid: "branch", name: "Utilities", direction: "both", is_active: true, created_at: "", updated_at: "" };
const input = { branchUuid: "branch", entryUuid: "stable-draft", editing: null, category, direction: "expense" as const, date: "2026-11-23", amount: 100, note: "" };
const existing: CashflowEntry = { entry_uuid: "old", branch_uuid: "branch", category_uuid_fk: "category", category_name: "Utilities", entry_date: "2026-11-23", direction: "expense", expense_group: "other", amount: 50, currency: "THB", exchange_rate: 650, base_amount: 32500, description: "Electricity bill", reference: "INV-001", note: "", payment_method: "transfer", version: 4, created_at: "", updated_at: "" };

describe("compact cashflow entry payload", () => {
  it("allows an empty note and supplies required backend fields without extra form inputs", () => {
    expect(compactCashflowEntryInput(input)).toMatchObject({ entry_uuid: "stable-draft", description: "Utilities", note: "", currency: "LAK", payment_method: "other", expense_group: "shop" });
    expect(compactCashflowEntryInput({ ...input, direction: "income" })).toMatchObject({ direction: "income", expense_group: null });
  });
  it("keeps full notes while bounding the derived description to its backend limit", () => {
    const note = "A".repeat(1500);
    const payload = compactCashflowEntryInput({ ...input, note: ` ${note} ` });
    expect(payload.note).toBe(note);
    expect(payload.description).toBe("A".repeat(500));
  });
  it("preserves currency, payment metadata and concurrency version while editing", () => {
    expect(compactCashflowEntryInput({ ...input, editing: existing, entryUuid: existing.entry_uuid, note: "Updated note", amount: 60 })).toMatchObject({ entry_uuid: "old", version: 4, currency: "THB", expense_group: "other", payment_method: "transfer", reference: "INV-001", description: "Updated note", note: "Updated note", amount: 60 });
    expect(compactCashflowEntryInput({ ...input, editing: existing, note: "Electricity bill" }).description).toBe("Electricity bill");
  });
  it("shows legacy descriptions as notes without duplicating generated category labels", () => {
    expect(cashflowEntryNote(existing)).toBe("Electricity bill");
    expect(cashflowEntryNote({ ...existing, note: "Receipt attached" })).toBe("Receipt attached");
    expect(cashflowEntryNote({ ...existing, description: existing.category_name })).toBe("");
  });
  it("keeps a deliberate note clear and category-only edit clear after saving", () => {
    const cleared = compactCashflowEntryInput({ ...input, editing: existing, note: "" });
    expect(cleared.description).toBe(category.name);
    expect(cashflowEntryNote({ ...existing, ...cleared, category_name: category.name })).toBe("");
    const changed = compactCashflowEntryInput({ ...input, editing: { ...existing, description: existing.category_name }, category: { ...category, name: "Rent" }, note: "" });
    expect(changed.description).toBe("Rent");
    expect(changed.note).toBe("");
  });
});

describe("quick cashflow entry without a category", () => {
  it("omits the category so the backend files it under the general category", () => {
    const payload = compactCashflowEntryInput({ ...input, category: null, generalLabel: "ທົ່ວໄປ" });
    expect(payload).not.toHaveProperty("category_uuid_fk");
    expect(payload.description).toBe("ທົ່ວໄປ");
    expect(compactCashflowEntryInput({ ...input, category: null, note: "ຄ່ານ້ຳ" }).description).toBe("ຄ່ານ້ຳ");
  });
});
