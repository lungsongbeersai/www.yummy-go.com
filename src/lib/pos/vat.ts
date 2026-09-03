import { roundLak } from "./lak-money";

// สูตร VAT ชุดเดียวของ Frontend ต้องตรงกับ
// back-end/api/v1/shared/vat-calculation.js เสมอ
// 1 = ไม่คิด VAT, 2 = ราคารวม VAT แล้ว, 3 = บวก VAT เพิ่ม
export const VAT_EXEMPT = 1;
export const VAT_INCLUDED = 2;
export const VAT_EXCLUDED = 3;

export interface VatResult {
  vatStatus: number;
  vatRate: number;
  amountBeforeVat: number;
  vatAmount: number;
  totalAfterVat: number;
}

// บิลเก่าที่ไม่มี snapshot คิดแบบเดิม = บวก VAT เพิ่ม
export function normalizeVatStatus(value: unknown, fallback = VAT_EXCLUDED) {
  const status = Number(value);
  return status === VAT_EXEMPT || status === VAT_INCLUDED || status === VAT_EXCLUDED
    ? status
    : fallback;
}

export function calculateVat({
  taxableAmount,
  vatStatus,
  vatRate,
  roundMoney = roundLak
}: {
  taxableAmount: number;
  vatStatus?: unknown;
  vatRate?: number;
  roundMoney?: (value: number) => number;
}): VatResult {
  const status = normalizeVatStatus(vatStatus);
  const taxable = roundMoney(Number(taxableAmount) || 0);
  const rate = status === VAT_EXEMPT ? 0 : Math.max(0, Number(vatRate) || 0);

  if (rate <= 0) {
    return {
      vatStatus: status,
      vatRate: rate,
      amountBeforeVat: taxable,
      vatAmount: 0,
      totalAfterVat: taxable
    };
  }

  if (status === VAT_INCLUDED) {
    const amountBeforeVat = roundMoney(taxable / (1 + rate / 100));
    return {
      vatStatus: status,
      vatRate: rate,
      amountBeforeVat,
      vatAmount: taxable - amountBeforeVat,
      totalAfterVat: taxable
    };
  }

  const vatAmount = roundMoney((taxable * rate) / 100);
  return {
    vatStatus: status,
    vatRate: rate,
    amountBeforeVat: taxable,
    vatAmount,
    totalAfterVat: taxable + vatAmount
  };
}
