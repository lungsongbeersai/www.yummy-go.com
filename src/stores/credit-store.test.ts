import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreditFetchResponse } from "@/services/credit";
import * as creditService from "@/services/credit";
import { useCreditStore } from "@/stores/credit-store";

vi.mock("@/services/credit", () => ({
  fetchCreditData: vi.fn(),
  fetchCreditPaymentSelection: vi.fn(),
  payCredit: vi.fn()
}));

vi.mock("@/stores/session-store-registry", () => ({
  createSessionGuard: () => () => true,
  registerSessionStoreReset: vi.fn()
}));

const fetchCreditDataMock = vi.mocked(creditService.fetchCreditData);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function billsResponse(paymentUuid: string): CreditFetchResponse {
  return {
    status: "success",
    message: "success",
    step: "select_bill",
    bills: [
      {
        payment_uuid: paymentUuid,
        order_uuid: `order-${paymentUuid}`,
        invoice_no: `invoice-${paymentUuid}`,
        bill_total: 1_000_000,
        paid_total: 0,
        balance: 1_000_000,
        credit_status: 1,
        credit_status_text: "Unpaid"
      }
    ]
  };
}

function customersResponse(customerUuid: string): CreditFetchResponse {
  return {
    status: "success",
    message: "success",
    step: "select_customer",
    customers: [
      {
        customer_uuid: customerUuid,
        customer_name: `customer-${customerUuid}`
      }
    ]
  };
}

describe("credit store customer selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreditStore.getState().reset();
  });

  it("keeps the newest customer's bills when an older request finishes last", async () => {
    const oldCustomer = deferred<CreditFetchResponse>();
    const currentCustomer = deferred<CreditFetchResponse>();
    fetchCreditDataMock
      .mockReturnValueOnce(oldCustomer.promise)
      .mockReturnValueOnce(currentCustomer.promise);

    const oldLoad = useCreditStore.getState().loadBills("branch-1", "customer-1", "la");
    const currentLoad = useCreditStore.getState().loadBills("branch-1", "customer-2", "la");

    currentCustomer.resolve(billsResponse("current-payment"));
    await currentLoad;
    oldCustomer.resolve(billsResponse("old-payment"));
    await oldLoad;

    expect(useCreditStore.getState().bills.map((bill) => bill.payment_uuid)).toEqual([
      "current-payment"
    ]);
    expect(useCreditStore.getState().loading).toBe(false);
  });

  it("does not restore bills from a request invalidated by clearing the customer", async () => {
    const pending = deferred<CreditFetchResponse>();
    fetchCreditDataMock.mockReturnValueOnce(pending.promise);

    const load = useCreditStore.getState().loadBills("branch-1", "customer-1", "la");
    useCreditStore.getState().clearBills();
    pending.resolve(billsResponse("stale-payment"));
    await load;

    expect(useCreditStore.getState().bills).toEqual([]);
    expect(useCreditStore.getState().summary).toBeNull();
    expect(useCreditStore.getState().loading).toBe(false);
  });

  it("clears dependent data immediately when the branch changes", async () => {
    const pending = deferred<CreditFetchResponse>();
    fetchCreditDataMock.mockReturnValueOnce(pending.promise);
    useCreditStore.setState({
      bills: billsResponse("old-payment").bills ?? [],
      customers: customersResponse("old-customer").customers ?? [],
      summary: {
        bill_count: 1,
        bill_total: 1_000_000,
        paid_total: 0,
        balance: 1_000_000
      }
    });

    const load = useCreditStore.getState().loadCustomers("branch-2", "la");

    expect(useCreditStore.getState().customers).toEqual([]);
    expect(useCreditStore.getState().bills).toEqual([]);
    expect(useCreditStore.getState().detail).toBeNull();
    expect(useCreditStore.getState().summary).toBeNull();

    pending.resolve(customersResponse("new-customer"));
    await load;
    expect(useCreditStore.getState().customers[0]?.customer_uuid).toBe("new-customer");
  });

  it("keeps customers from the newest branch when requests finish out of order", async () => {
    const oldBranch = deferred<CreditFetchResponse>();
    const currentBranch = deferred<CreditFetchResponse>();
    fetchCreditDataMock
      .mockReturnValueOnce(oldBranch.promise)
      .mockReturnValueOnce(currentBranch.promise);

    const oldLoad = useCreditStore.getState().loadCustomers("branch-1", "la");
    const currentLoad = useCreditStore.getState().loadCustomers("branch-2", "la");

    currentBranch.resolve(customersResponse("branch-2-customer"));
    await currentLoad;
    oldBranch.resolve(customersResponse("branch-1-customer"));
    await oldLoad;

    expect(useCreditStore.getState().customers.map((customer) => customer.customer_uuid)).toEqual([
      "branch-2-customer"
    ]);
  });
});
