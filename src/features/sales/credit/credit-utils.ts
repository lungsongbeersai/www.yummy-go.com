import type { CreditBill, CreditPayMethod, CreditPayMode } from "@/services/credit";

export type CreditPaymentValidationError =
  | "customerRequired"
  | "selectOneBill"
  | "selectMultipleBills"
  | "invalidBalance"
  | "cashInsufficient"
  | "transferMismatch"
  | "mixedAmountsRequired"
  | "mixedAmountMismatch";

function cents(value: number) {
  return Math.round(value * 100);
}

export function toCreditAmount(value: string | number | null | undefined) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export function creditChange(
  method: CreditPayMethod,
  cash: number,
  transfer: number,
  total: number
) {
  if (method === 2) return 0;
  return Math.max(cents(cash + transfer - total) / 100, 0);
}

export function selectedCreditBills(bills: CreditBill[], selectedUuids: string[]) {
  const selected = new Set(selectedUuids);
  return bills.filter((bill) => selected.has(bill.payment_uuid));
}

export function creditAllocationTotal(
  bills: CreditBill[],
  selectedUuids: string[]
) {
  return selectedCreditBills(bills, selectedUuids).reduce(
    (sum, bill) => sum + toCreditAmount(bill.balance),
    0
  );
}

export function validateCreditPayment(input: {
  customerUuid: string;
  mode: CreditPayMode;
  bills: CreditBill[];
  selectedUuids: string[];
  payMethod: CreditPayMethod;
  cashAmount: number;
  transferAmount: number;
}): CreditPaymentValidationError | null {
  if (!input.customerUuid) return "customerRequired";

  const bills = selectedCreditBills(input.bills, input.selectedUuids);
  if (input.mode === "single" && bills.length !== 1) return "selectOneBill";
  if (input.mode === "multiple" && bills.length < 2) return "selectMultipleBills";

  for (const bill of bills) {
    if (cents(toCreditAmount(bill.balance)) <= 0) return "invalidBalance";
  }

  const total = creditAllocationTotal(input.bills, input.selectedUuids);
  const cash = Math.max(input.cashAmount, 0);
  const transfer = Math.max(input.transferAmount, 0);

  if (input.payMethod === 1 && cents(cash) < cents(total)) return "cashInsufficient";
  if (input.payMethod === 2 && (cents(cash) !== 0 || cents(transfer) !== cents(total))) {
    return "transferMismatch";
  }
  if (input.payMethod === 3) {
    if (cents(cash) <= 0 || cents(transfer) <= 0) return "mixedAmountsRequired";
    const change = creditChange(3, cash, transfer, total);
    if (cents(change) > cents(cash) || cents(cash - change + transfer) !== cents(total)) {
      return "mixedAmountMismatch";
    }
  }

  return null;
}
