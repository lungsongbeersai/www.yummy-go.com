import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiRequest: apiMocks.apiRequest }));

import {
  fetchBanks,
  fetchBranchAccounts,
  fetchPosTransferAccounts,
  saveBank,
  saveBranchAccount,
} from "@/services/bank-account";

describe("bank account service", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    apiMocks.apiRequest.mockResolvedValue({
      status: "success",
      message: "success",
      data: [],
    });
  });

  it("uses the bank and branch-account management endpoints", async () => {
    await fetchBanks();
    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith(
      "get",
      "/api/v1/bank/fetch_all",
    );

    await fetchBranchAccounts("branch-1");
    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith(
      "get",
      "/api/v1/account/fetch_all",
      { params: { branch_uuid_fk: "branch-1" } },
    );

    await saveBank({
      bank_name_la: "Bank LA",
      bank_name_eng: "Bank EN",
      bank_status: 1,
    });
    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith(
      "post",
      "/api/v1/bank/create",
      {
        data: {
          bank_name_la: "Bank LA",
          bank_name_eng: "Bank EN",
          bank_status: 1,
        },
      },
    );

    await saveBranchAccount({
      bank_uuid_fk: "bank-1",
      branch_uuid_fk: "branch-1",
      account_name: "Main",
      account_number: "010001",
      account_status: 1,
    });
    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith(
      "post",
      "/api/v1/account/create",
      {
        data: {
          bank_uuid_fk: "bank-1",
          branch_uuid_fk: "branch-1",
          account_name: "Main",
          account_number: "010001",
          account_status: 1,
        },
      },
    );
  });

  it("loads POS transfer accounts from the authenticated branch endpoint", async () => {
    await fetchPosTransferAccounts();
    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/posAll/transfer_accounts",
    );
  });

  it("uploads an account QR as multipart form data", async () => {
    const qr = new File(["qr"], "account-qr.png", { type: "image/png" });

    await saveBranchAccount({
      bank_uuid_fk: "bank-1",
      branch_uuid_fk: "branch-1",
      account_name: "Main",
      account_number: "010001",
      account_qr: qr,
      account_status: 1,
    });

    const options = apiMocks.apiRequest.mock.calls.at(-1)?.[2];
    expect(options?.data).toBeInstanceOf(FormData);
    expect(options?.data.get("account_qr")).toBe(qr);
    expect(options?.data.get("account_number")).toBe("010001");
  });
});
