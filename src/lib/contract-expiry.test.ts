import { describe, expect, it } from "vitest";
import { contractExpiryFromError, contractExpiryFromPayload, isContractExpiredError } from "./contract-expiry";

const payload = {
  code: "BRANCH_CONTRACT_EXPIRED", branch_uuid: "A0000000-0000-4000-8000-000000000001",
  contract_end_on: "2026-10-28", contract_days_remaining: -1,
};

describe("authoritative contract expiry notices", () => {
  it("accepts only the explicit backend code and validated display metadata", () => {
    expect(contractExpiryFromPayload(payload)).toEqual({
      branchUuid: "a0000000-0000-4000-8000-000000000001", endOn: "2026-10-28", daysRemaining: -1,
    });
    for (const value of [null, undefined, "BRANCH_CONTRACT_EXPIRED", {}, { code: "ACCOUNT_INACTIVE" }, { message: "Branch contract expired" }]) {
      expect(contractExpiryFromPayload(value)).toBeNull();
    }
  });

  it("retains a generic expiry reason without trusting malformed metadata", () => {
    expect(contractExpiryFromPayload({ ...payload, branch_uuid: "//external.test", contract_end_on: "2026-02-30", contract_days_remaining: "-1" })).toEqual({});
    for (const contract_end_on of ["0000-01-01", "2026-1-01", "2026-01-01T00:00:00Z", "2026-13-01", null]) {
      expect(contractExpiryFromPayload({ ...payload, contract_end_on })).not.toHaveProperty("endOn");
    }
    for (const contract_days_remaining of [0, 1, -1.5, NaN, -Infinity, Number.MIN_SAFE_INTEGER - 1, null]) {
      expect(contractExpiryFromPayload({ ...payload, contract_days_remaining })).not.toHaveProperty("daysRemaining");
    }
  });

  it("recognizes ServiceError and Axios rejection envelopes only for an unauthorized response", () => {
    for (const value of [{ statusCode: 401, payload }, { response: { status: 401, data: payload } }]) {
      expect(isContractExpiredError(value)).toBe(true);
      expect(contractExpiryFromError(value)?.endOn).toBe("2026-10-28");
    }
    for (const value of [new Error("contract expired"), { statusCode: 403, payload }, { statusCode: 500, payload },
      { response: { status: 503, data: payload } }, { statusCode: 0, payload }, { statusCode: 401, payload: { code: "ACCOUNT_INACTIVE" } }]) {
      expect(isContractExpiredError(value)).toBe(false);
    }
  });
});
