import { describe, expect, it } from "vitest";
import { ServiceError } from "@/lib/api";
import {
  isBranchMenuQrToken,
  isPublicQrRevokedError,
  PUBLIC_QR_REVOKED_CODE,
} from "@/services/public-pos/qr-token";

describe("public QR token helpers", () => {
  it("tells a branch menu token from a table token by prefix alone", () => {
    expect(isBranchMenuQrToken(" bq1.abc.def.ghi ")).toBe(true);
    expect(isBranchMenuQrToken("q1.abc.1.def.ghi")).toBe(false);
  });

  it("reads the revoked code off the error assertApiSuccess throws", () => {
    expect(
      isPublicQrRevokedError(
        new ServiceError("qr disabled", PUBLIC_QR_REVOKED_CODE),
      ),
    ).toBe(true);
    expect(
      isPublicQrRevokedError(new ServiceError("token revoked", 410)),
    ).toBe(true);
  });

  it("leaves retryable failures alone", () => {
    expect(isPublicQrRevokedError(new ServiceError("invalid/expired token", 400))).toBe(
      false,
    );
    expect(isPublicQrRevokedError(new ServiceError("Connection timed out", 408))).toBe(
      false,
    );
    expect(isPublicQrRevokedError(new Error("boom"))).toBe(false);
    expect(isPublicQrRevokedError(null)).toBe(false);
    expect(isPublicQrRevokedError(undefined)).toBe(false);
  });
});
