import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DepositDetailResponse, DepositListResponse } from "@/services/deposit";
import * as depositService from "@/services/deposit";
import { useDepositStore } from "@/stores/deposit-store";

vi.mock("@/services/deposit", () => ({
  fetchDepositList: vi.fn(),
  fetchDepositDetail: vi.fn(),
  fetchDepositOrderRedemptions: vi.fn(),
  createDeposit: vi.fn(),
  withdrawDeposit: vi.fn()
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

describe("deposit store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDepositStore.getState().reset();
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

  it("prepends a newly created deposit to rows", async () => {
    const created = listResponse("new-deposit").data[0];
    vi.mocked(depositService.createDeposit).mockResolvedValueOnce({
      status: "success",
      message: "success",
      lang: "la",
      idempotent_replay: false,
      deposit: created
    });

    useDepositStore.setState({ rows: [listResponse("existing").data[0]] });

    await useDepositStore.getState().create({
      request_uuid: "request-1",
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      pro_detail_uuid: "detail-1",
      deposit_qty: 1
    });

    expect(useDepositStore.getState().rows.map((row) => row.deposit_uuid)).toEqual([
      "new-deposit",
      "existing"
    ]);
    expect(useDepositStore.getState().saving).toBe(false);
  });
});
