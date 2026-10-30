import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DepositCreateResponse, DepositDetailResponse, DepositListResponse, DepositWithdrawResponse
} from "@/services/deposit";
import * as depositService from "@/services/deposit";
import { useDepositStore } from "@/stores/deposit-store";

const printerMocks = vi.hoisted(() => ({ executeReport: vi.fn(), resolveContext: vi.fn() }));

vi.mock("@/services/deposit", () => ({
  fetchDepositList: vi.fn(),
  fetchDepositDetail: vi.fn(),
  fetchDepositOrderRedemptions: vi.fn(),
  createDeposit: vi.fn(),
  withdrawDeposit: vi.fn(),
  reprintDepositReceipt: vi.fn()
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: { getState: () => ({ user: { uuid: "login-1" } }) }
}));
vi.mock("@/stores/printer-store", () => ({
  usePrinterStore: { getState: () => ({ executeReport: printerMocks.executeReport }) }
}));
vi.mock("@/stores/pos-store/printer-context", () => ({
  resolvePosPrinterContext: printerMocks.resolveContext
}));

vi.mock("@/stores/session-store-registry", () => ({
  createSessionGuard: () => () => true,
  registerSessionStoreReset: vi.fn()
}));

const fetchDepositListMock = vi.mocked(depositService.fetchDepositList);
const fetchDepositDetailMock = vi.mocked(depositService.fetchDepositDetail);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function listResponse(depositUuid: string): DepositListResponse {
  return {
    status: "success",
    message: "success",
    lang: "la",
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    filter_status: "active",
    order_uuid: null,
    search: "",
    data: [
      {
        deposit_uuid: depositUuid,
        deposit_no: `DP-${depositUuid}`,
        branch_uuid_fk: "branch-1",
        customer_uuid_fk: "customer-1",
        customer_name: "customer",
        customer_phone: "",
        pro_detail_uuid_fk: "detail-1",
        order_uuid_fk: null,
        product_name: "Whisky",
        unit_name: "bottle",
        deposit_qty: 1,
        remaining_qty: 1,
        deposit_date: "2026-09-16T00:00:00.000Z",
        expire_date: "2026-12-31",
        status: "ACTIVE",
        status_text: "Active",
        is_expired: false,
        note: "",
        created_by: null,
        created_at: "2026-09-16T00:00:00.000Z",
        updated_at: "2026-09-16T00:00:00.000Z"
      }
    ]
  };
}

function detailResponse(depositUuid: string): DepositDetailResponse {
  return {
    status: "success",
    message: "success",
    lang: "la",
    deposit: listResponse(depositUuid).data[0],
    withdrawals: []
  };
}

function createResponse(printJobUuid?: string): DepositCreateResponse {
  return {
    status: "success", message: "success", lang: "la", request_uuid: "saved-batch-1",
    idempotent_replay: false, deposit_date: "2026-10-30", expire_date: "2026-11-06",
    deposits: [listResponse("deposit-1").data[0]],
    ...(printJobUuid ? {
      print_status: "queued" as const,
      pending_query: { print_job_uuid: printJobUuid, login_uuid_fk: "login-1" },
      print_job: { print_job_uuid: printJobUuid, job_status: "pending" },
    } : {})
  };
}

function withdrawResponse(printJobUuid?: string): DepositWithdrawResponse {
  return {
    status: "success", message: "success", lang: "la", idempotent_replay: false,
    deposit: { ...listResponse("deposit-1").data[0], remaining_qty: 0.5 },
    withdrawal: {
      withdrawal_uuid: "withdrawal-1", deposit_uuid_fk: "deposit-1", order_uuid_fk: "order-1",
      qty_withdrawn: 0.5, qty_before: 1, qty_after: 0.5, withdrawn_by: "login-1",
      withdrawn_at: "2026-10-30T12:00:00Z", note: "",
    },
    ...(printJobUuid ? {
      print_status: "queued" as const,
      pending_query: { print_job_uuid: printJobUuid, login_uuid_fk: "login-1" },
    } : {})
  };
}

describe("deposit store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDepositStore.getState().reset();
    printerMocks.resolveContext.mockReset().mockResolvedValue({
      device_code: "DESKTOP-1", agent_id: "agent-1", print_mode: "windows_agent"
    });
    printerMocks.executeReport.mockReset().mockResolvedValue({ successCount: 1, failedCount: 0, total: 1 });
  });

  it("keeps the newest branch's rows when requests finish out of order", async () => {
    const oldBranch = deferred<DepositListResponse>();
    const currentBranch = deferred<DepositListResponse>();
    fetchDepositListMock.mockReturnValueOnce(oldBranch.promise).mockReturnValueOnce(currentBranch.promise);

    const oldLoad = useDepositStore.getState().loadList({ branchUuid: "branch-1" });
    const currentLoad = useDepositStore.getState().loadList({ branchUuid: "branch-2" });

    currentBranch.resolve(listResponse("current-deposit"));
    await currentLoad;
    oldBranch.resolve(listResponse("old-deposit"));
    await oldLoad;

    expect(useDepositStore.getState().rows.map((row) => row.deposit_uuid)).toEqual(["current-deposit"]);
    expect(useDepositStore.getState().loading).toBe(false);
  });

  it("does not restore a detail load invalidated by clearDetail", async () => {
    const pending = deferred<DepositDetailResponse>();
    fetchDepositDetailMock.mockReturnValueOnce(pending.promise);

    const load = useDepositStore.getState().loadDetail("deposit-1");
    useDepositStore.getState().clearDetail();
    pending.resolve(detailResponse("deposit-1"));
    await load;

    expect(useDepositStore.getState().detail).toBeNull();
    expect(useDepositStore.getState().detailLoading).toBe(false);
  });

  it("loads all deposits linked to the current order", async () => {
    fetchDepositListMock.mockResolvedValueOnce(listResponse("order-deposit"));

    await useDepositStore.getState().loadOrderDeposits({
      branchUuid: "branch-1",
      orderUuid: "order-1",
      lang: "la"
    });

    expect(fetchDepositListMock).toHaveBeenCalledWith({
      branch_uuid: "branch-1",
      order_uuid: "order-1",
      status: "all",
      limit: 100,
      lang: "la"
    });
    expect(useDepositStore.getState().orderRows.map((row) => row.deposit_uuid)).toEqual([
      "order-deposit"
    ]);
    expect(useDepositStore.getState().loadedOrderUuid).toBe("order-1");
    expect(useDepositStore.getState().orderLoading).toBe(false);
  });

  it("prepends every newly created deposit to rows", async () => {
    const created = listResponse("new-deposit").data[0];
    const createdSecond = listResponse("new-deposit-2").data[0];
    vi.mocked(depositService.createDeposit).mockResolvedValueOnce({
      status: "success",
      message: "success",
      lang: "la",
      request_uuid: "request-1",
      idempotent_replay: false,
      deposit_date: "2026-09-16",
      expire_date: "2026-12-31",
      deposits: [created, createdSecond]
    });

    useDepositStore.setState({ rows: [listResponse("existing").data[0]] });

    await useDepositStore.getState().create({
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 1 }]
    });

    expect(useDepositStore.getState().rows.map((row) => row.deposit_uuid)).toEqual([
      "new-deposit",
      "new-deposit-2",
      "existing"
    ]);
    expect(useDepositStore.getState().saving).toBe(false);
  });

  it("also updates the current order availability after a POS deposit", async () => {
    const created = listResponse("new-order-deposit").data[0];
    vi.mocked(depositService.createDeposit).mockResolvedValueOnce({
      status: "success",
      message: "success",
      lang: "la",
      request_uuid: "request-2",
      idempotent_replay: false,
      deposit_date: "2026-09-16",
      expire_date: "2026-12-31",
      deposits: [created]
    });

    await useDepositStore.getState().create({
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      order_uuid: "order-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 1 }]
    });

    expect(useDepositStore.getState().orderRows.map((row) => row.deposit_uuid)).toEqual([
      "new-order-deposit"
    ]);
  });

  it("reuses an uncertain deposit operation identity instead of creating a second business operation", async () => {
    const input = {
      branch_uuid: "branch-1", customer_uuid: "customer-1", order_uuid: "order-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 0.5 }],
    };
    vi.mocked(depositService.createDeposit)
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValueOnce({ ...createResponse(), idempotent_replay: true });
    await expect(useDepositStore.getState().create(input)).rejects.toThrow("Response lost");
    const firstId = vi.mocked(depositService.createDeposit).mock.calls[0][0].request_uuid;
    await useDepositStore.getState().create(input);
    expect(depositService.createDeposit).toHaveBeenLastCalledWith(expect.objectContaining({
      request_uuid: firstId, device_code: "DESKTOP-1", agent_id: "agent-1", print_mode: "windows_agent",
    }));
    expect(useDepositStore.getState().rows).toHaveLength(1);
    expect(useDepositStore.getState().lastReceipt?.depositNos).toEqual(["DP-deposit-1"]);
  });

  it("coalesces simultaneous identical deposit submissions", async () => {
    const pending = deferred<DepositCreateResponse>();
    vi.mocked(depositService.createDeposit).mockReturnValueOnce(pending.promise);
    const input = {
      branch_uuid: "branch-1", customer_uuid: "customer-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 1 }],
    };
    const first = useDepositStore.getState().create(input);
    const second = useDepositStore.getState().create(input);
    pending.resolve(createResponse());
    await Promise.all([first, second]);
    expect(depositService.createDeposit).toHaveBeenCalledTimes(1);
  });

  it("keeps a committed deposit successful when its queued receipt fails and only reprints the receipt", async () => {
    vi.mocked(depositService.createDeposit).mockResolvedValueOnce(createResponse("first-print"));
    printerMocks.executeReport.mockRejectedValueOnce(new Error("Printer disconnected"));
    const response = await useDepositStore.getState().create({
      branch_uuid: "branch-1", customer_uuid: "customer-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 1 }],
    });
    expect(response.status).toBe("success");
    expect(useDepositStore.getState().error).toBeNull();
    expect(useDepositStore.getState().lastReceipt).toMatchObject({
      outcome: "error", message: "Printer disconnected", printJobUuid: "first-print",
      requestUuid: "saved-batch-1", depositNos: ["DP-deposit-1"],
    });
    vi.mocked(depositService.reprintDepositReceipt).mockResolvedValueOnce({
      status: "success", message: "success", print_status: "queued",
      pending_query: { print_job_uuid: "fresh-print", login_uuid_fk: "login-1" },
    });
    await useDepositStore.getState().reprintReceipt();
    expect(depositService.reprintDepositReceipt).toHaveBeenCalledWith(expect.objectContaining({
      kind: "deposit", deposit_request_uuid: "saved-batch-1", request_uuid: expect.any(String),
    }));
    expect(depositService.createDeposit).toHaveBeenCalledTimes(1);
    expect(depositService.withdrawDeposit).not.toHaveBeenCalled();
    expect(printerMocks.executeReport).toHaveBeenLastCalledWith(expect.objectContaining({
      pending_query: { print_job_uuid: "fresh-print", login_uuid_fk: "login-1" },
    }));
    expect(useDepositStore.getState().lastReceipt?.outcome).toBe("success");
  });

  it("keeps a saved receipt available when no deposit printer is configured", async () => {
    vi.mocked(depositService.createDeposit).mockResolvedValueOnce({
      ...createResponse(), print_status: "skipped", print: { role_code: "deposit", reason: "No deposit printer" },
    });
    await useDepositStore.getState().create({
      branch_uuid: "branch-1", customer_uuid: "customer-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 1 }],
    });
    expect(printerMocks.executeReport).not.toHaveBeenCalled();
    expect(useDepositStore.getState().lastReceipt).toMatchObject({ outcome: "skipped", message: "No deposit printer" });
  });

  it("does not physically replay an already successful receipt returned by an idempotent mutation", async () => {
    vi.mocked(depositService.createDeposit).mockResolvedValueOnce({
      ...createResponse("existing-successful-job"), idempotent_replay: true, print_status: "success",
    });
    await useDepositStore.getState().create({
      branch_uuid: "branch-1", customer_uuid: "customer-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 1 }],
    });
    expect(printerMocks.executeReport).not.toHaveBeenCalled();
    expect(useDepositStore.getState().lastReceipt?.outcome).toBe("success");
  });

  it("checks an existing pending receipt without requesting a duplicate physical copy", async () => {
    vi.mocked(depositService.createDeposit).mockResolvedValueOnce(createResponse("remote-job"));
    printerMocks.executeReport
      .mockResolvedValueOnce({ successCount: 0, failedCount: 0, total: 1, pending: true })
      .mockResolvedValueOnce({ successCount: 1, failedCount: 0, total: 1 });
    await useDepositStore.getState().create({
      branch_uuid: "branch-1", customer_uuid: "customer-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 1 }],
    });
    expect(useDepositStore.getState().lastReceipt?.outcome).toBe("pending");
    await useDepositStore.getState().reprintReceipt();
    expect(depositService.reprintDepositReceipt).not.toHaveBeenCalled();
    expect(printerMocks.executeReport).toHaveBeenCalledTimes(2);
    expect(printerMocks.executeReport).toHaveBeenLastCalledWith(expect.objectContaining({
      pending_query: { print_job_uuid: "remote-job", login_uuid_fk: "login-1" },
    }));
    expect(useDepositStore.getState().lastReceipt?.outcome).toBe("success");
  });

  it("retains the print operation UUID when the reprint enqueue response is lost", async () => {
    vi.mocked(depositService.createDeposit).mockResolvedValueOnce({ ...createResponse(), print_status: "skipped" });
    await useDepositStore.getState().create({
      branch_uuid: "branch-1", customer_uuid: "customer-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 1 }],
    });
    vi.mocked(depositService.reprintDepositReceipt)
      .mockRejectedValueOnce(new Error("Enqueue response lost"))
      .mockResolvedValueOnce({
        status: "success", message: "success", print_status: "queued",
        pending_query: { print_job_uuid: "recovered-job", login_uuid_fk: "login-1" },
      });
    await useDepositStore.getState().reprintReceipt();
    const firstPrintUuid = vi.mocked(depositService.reprintDepositReceipt).mock.calls[0][0].request_uuid;
    await useDepositStore.getState().reprintReceipt();
    expect(depositService.reprintDepositReceipt).toHaveBeenLastCalledWith(expect.objectContaining({ request_uuid: firstPrintUuid }));
    expect(depositService.createDeposit).toHaveBeenCalledTimes(1);
  });

  it("reuses an uncertain withdrawal identity and refreshes balances without duplicating the history", async () => {
    const response = withdrawResponse("withdraw-print");
    useDepositStore.setState({
      rows: [listResponse("deposit-1").data[0]], orderRows: [listResponse("deposit-1").data[0]],
      detail: response.deposit, detailWithdrawals: [response.withdrawal],
    });
    vi.mocked(depositService.withdrawDeposit)
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValueOnce({ ...response, idempotent_replay: true });
    const input = { request_uuid: "first-attempt", deposit_uuid: "deposit-1", qty_withdrawn: 0.5 };
    await expect(useDepositStore.getState().withdraw(input)).rejects.toThrow("Response lost");
    await useDepositStore.getState().withdraw({ ...input, request_uuid: "regenerated-ui-id" });
    expect(depositService.withdrawDeposit).toHaveBeenLastCalledWith(expect.objectContaining({ request_uuid: "first-attempt" }));
    expect(useDepositStore.getState().detailWithdrawals).toHaveLength(1);
    expect(useDepositStore.getState().orderRows[0].remaining_qty).toBe(0.5);
    expect(useDepositStore.getState().lastReceipt).toMatchObject({
      kind: "withdrawal", withdrawalUuid: "withdrawal-1", outcome: "success",
    });
  });

  it("loads every availability page before allowing more quantities to be deposited", async () => {
    fetchDepositListMock
      .mockResolvedValueOnce({ ...listResponse("first-deposit"), total: 101, totalPages: 2 })
      .mockResolvedValueOnce({ ...listResponse("last-deposit"), page: 2, total: 101, totalPages: 2 });
    const rows = await useDepositStore.getState().loadOrderDeposits({ branchUuid: "branch-1", orderUuid: "order-1" });
    expect(rows.map((row) => row.deposit_uuid)).toEqual(["first-deposit", "last-deposit"]);
    expect(fetchDepositListMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 100 }));
    expect(useDepositStore.getState().orderRows).toHaveLength(2);
  });

  it("does not prepend an older customer's saved deposit after the list selection changes", async () => {
    const pendingCreate = deferred<DepositCreateResponse>();
    vi.mocked(depositService.createDeposit).mockReturnValueOnce(pendingCreate.promise);
    const saving = useDepositStore.getState().create({
      branch_uuid: "branch-1", customer_uuid: "customer-1",
      items: [{ pro_detail_uuid: "detail-1", deposit_qty: 1 }],
    });
    fetchDepositListMock.mockResolvedValueOnce({
      ...listResponse("different-customer-deposit"),
      data: [{ ...listResponse("different-customer-deposit").data[0], customer_uuid_fk: "customer-2" }],
    });
    await useDepositStore.getState().loadList({ branchUuid: "branch-1", customerUuid: "customer-2" });
    pendingCreate.resolve(createResponse());
    await saving;
    expect(useDepositStore.getState().rows.map((row) => row.deposit_uuid)).toEqual(["different-customer-deposit"]);
    expect(useDepositStore.getState().lastReceipt?.depositUuids).toEqual(["deposit-1"]);
  });

  it("does not replace a newer selected detail when an earlier withdrawal completes", async () => {
    const pendingWithdraw = deferred<DepositWithdrawResponse>();
    useDepositStore.setState({ detail: listResponse("deposit-1").data[0] });
    vi.mocked(depositService.withdrawDeposit).mockReturnValueOnce(pendingWithdraw.promise);
    const withdrawing = useDepositStore.getState().withdraw({ deposit_uuid: "deposit-1", qty_withdrawn: 0.5 });
    fetchDepositDetailMock.mockResolvedValueOnce(detailResponse("deposit-2"));
    await useDepositStore.getState().loadDetail("deposit-2");
    pendingWithdraw.resolve(withdrawResponse());
    await withdrawing;
    expect(useDepositStore.getState().detail?.deposit_uuid).toBe("deposit-2");
    expect(useDepositStore.getState().detailWithdrawals).toEqual([]);
    expect(useDepositStore.getState().lastReceipt?.withdrawalUuid).toBe("withdrawal-1");
  });

  it("keeps repeated history reprints scoped to the selected deposit rather than its entire original batch", async () => {
    useDepositStore.setState({ rows: [listResponse("deposit-1").data[0]] });
    vi.mocked(depositService.reprintDepositReceipt).mockResolvedValue({
      status: "success", message: "success", request_uuid: "original-batch-uuid", print_status: "success",
      deposits: [listResponse("deposit-1").data[0]],
    });
    await useDepositStore.getState().reprint({ kind: "deposit", deposit_uuid: "deposit-1" });
    expect(useDepositStore.getState().lastReceipt?.requestUuid).toBe("original-batch-uuid");
    await useDepositStore.getState().reprintReceipt();
    expect(depositService.reprintDepositReceipt).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: "deposit", deposit_uuid: "deposit-1",
    }));
    expect(vi.mocked(depositService.reprintDepositReceipt).mock.calls[1][0].deposit_request_uuid).toBeUndefined();
  });
});
