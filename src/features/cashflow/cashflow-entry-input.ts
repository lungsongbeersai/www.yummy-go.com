import type { CashflowCategory, CashflowDirection, CashflowEntry, SaveCashflowEntryInput } from "@/services/cashflow";

export function cashflowEntryNote(entry: CashflowEntry) {
  return entry.note || (entry.description !== entry.category_name ? entry.description : "");
}

interface CompactCashflowEntryInput {
  branchUuid: string;
  entryUuid: string;
  editing: CashflowEntry | null;
  category: CashflowCategory;
  direction: CashflowDirection;
  date: string;
  amount: number;
  note: string;
}

export function compactCashflowEntryInput({ branchUuid, entryUuid, editing, category, direction, date, amount, note }: CompactCashflowEntryInput): SaveCashflowEntryInput {
  const trimmedNote = note.trim();
  const unchangedLegacyNote = editing && trimmedNote && trimmedNote === cashflowEntryNote(editing).trim();
  return {
    branch_uuid_fk: branchUuid,
    entry_uuid: entryUuid,
    ...(editing ? { version: editing.version } : {}),
    entry_date: date,
    direction,
    category_uuid_fk: category.category_uuid,
    amount,
    note: trimmedNote,
    description: unchangedLegacyNote ? editing.description : trimmedNote.slice(0, 500) || category.name,
    currency: editing?.currency ?? "LAK",
    expense_group: direction === "expense" ? editing?.expense_group ?? "shop" : null,
    payment_method: editing?.payment_method ?? "other",
    reference: editing?.reference ?? "",
  };
}
