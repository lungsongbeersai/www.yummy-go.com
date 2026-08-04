import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";

export type CreditPayMode = "single" | "multiple";
export type CreditPayMethod = 1 | 2 | 3;

export interface CreditBranch {
  branch_uuid: string;
  branch_name: string;
}

export interface CreditCustomer {
  customer_uuid: string;
  customer_name: string;
  member_code?: string;
  customer_phone?: string;
  customer_address?: string;
  bill_count?: number;
  bill_total?: number;
  paid_total?: number;
  balance?: number;
}

export interface CreditSummary {
  bill_count: number;
  customer_count?: number;
  bill_total: number;
  paid_total: number;
  balance: number;
}

export interface CreditBill {
  payment_uuid: string;
  order_uuid: string;
  invoice_no: string;
  customer_uuid?: string;
  customer_name?: string;
  sale_date?: string | null;
  due_date?: string | null;
  order_qty?: number;
  subtotal?: number;
  discount?: number;
  service_charge?: number;
  vat?: number;
  bill_total: number;
  paid_total: number;
  balance: number;
  credit_status: number;
  credit_status_text: string;
}

export interface CreditTopping {
  topping_uuid: string;
  topping_name: string;
  topping_name_la?: string;
  topping_name_eng?: string;
  topping_qty: number;
  topping_qty_per_unit?: number;
  topping_price: number;
  topping_unit_total?: number;
  topping_total: number;
}

export interface CreditOrderItem {
  order_item_uuid: string;
  product_code: string;
  product_name: string;
  qty: number;
  unit_price: number;
  toppings: CreditTopping[];
  topping_total: number;
  gross_total: number;
  item_discount_type: string;
  item_discount_value: number;
  item_discount_amount: number;
  line_total: number;
  note: string;
}

export interface CreditSingleBillDetail extends CreditBill {
  items: CreditOrderItem[];
  grand_total: number;
}

export interface CreditFetchResponse {
  status: "success";
  message: string;
  step: "select_branch" | "select_customer" | "select_bill";
  bill_status?: "all" | "open" | "paid";
  customer_selection?: "all" | "customer";
  branches?: CreditBranch[];
  branch?: CreditBranch;
  customers?: CreditCustomer[];
  customer?: CreditCustomer;
  summary?: CreditSummary;
  bills?: CreditBill[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface CreditSelectedBillsResponse {
  status: "success";
  message: string;
  payment_type: CreditPayMode;
  branch: CreditBranch;
  customer: CreditCustomer & { member_code?: string };
  bill?: CreditSingleBillDetail;
  bills?: CreditBill[];
  totals?: CreditSummary;
}

export interface CreditAllocationInput {
  payment_uuid: string;
  pay_amount: number;
}

export interface PayCreditInput {
  request_uuid: string;
  branch_uuid: string;
  customer_uuid: string;
  payment_type: CreditPayMode;
  payment_method: CreditPayMethod;
  cash_payment_amount: number;
  transfer_payment_amount: number;
  change_amount: number;
  note?: string;
  items: CreditAllocationInput[];
  lang?: string;
}

export interface PayCreditResponse {
  status: "success";
  message: string;
  idempotent_replay: boolean;
  receipt: {
    receipt_uuid: string;
    receipt_no: string;
    customer_uuid: string;
    total: number;
    cash: number;
    transfer: number;
    change: number;
    payment_method: number;
    payment_method_text: string;
    received_at: string;
  };
  paid_bills: Array<{
    payment_uuid: string;
    invoice_no: string;
    paid_amount: number;
    balance: number;
  }>;
  payment_selection?: CreditFetchResponse;
}

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new ServiceError(`${label} is required`, 400);
  return normalized;
}

export function fetchCreditData(params: {
  branch_uuid?: string;
  customer_uuid?: string;
  lang?: string;
  page?: number;
  limit?: number;
}) {
  const branchUuid = params.branch_uuid?.trim();
  const customerUuid = params.customer_uuid?.trim();

  return apiRequest<CreditFetchResponse>("get", "/api/v1/pos/credit/payment-selection", {
    params: {
      lang: toApiLanguage(params.lang),
      ...(branchUuid ? { branch_uuid: branchUuid } : {}),
      ...(customerUuid
        ? {
            customer_uuid: customerUuid,
            bill_status: "open",
            page: params.page ?? 1,
            limit: params.limit ?? 100
          }
        : {})
    }
  });
}

export function fetchCreditPaymentSelection(input: {
  branch_uuid: string;
  customer_uuid: string;
  bill_uuids: string[];
  lang?: string;
}) {
  if (!input.bill_uuids.length) {
    throw new ServiceError("bill_uuids is required", 400);
  }

  return apiRequest<CreditSelectedBillsResponse>(
    "get",
    "/api/v1/pos/credit/payment-selection",
    {
      params: {
        branch_uuid: required(input.branch_uuid, "branch_uuid"),
        customer_uuid: required(input.customer_uuid, "customer_uuid"),
        payment_type: input.bill_uuids.length === 1 ? "single" : "multiple",
        bill_uuids: input.bill_uuids.join(","),
        lang: toApiLanguage(input.lang)
      }
    }
  );
}

export function payCredit(input: PayCreditInput) {
  if (!input.items.length) throw new ServiceError("items is required", 400);

  return apiRequest<PayCreditResponse>("post", "/api/v1/pos/credit/payment", {
    data: {
      ...input,
      request_uuid: required(input.request_uuid, "request_uuid"),
      branch_uuid: required(input.branch_uuid, "branch_uuid"),
      customer_uuid: required(input.customer_uuid, "customer_uuid"),
      lang: toApiLanguage(input.lang)
    }
  });
}
