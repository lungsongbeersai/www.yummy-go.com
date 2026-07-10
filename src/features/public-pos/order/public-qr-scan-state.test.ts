import { describe, expect, it } from "vitest";
import {
  currentPublicQrScanStatus,
  isPublicQrScanLoading,
  PUBLIC_QR_SCAN_STATUS,
  publicQrScanRequestKey,
} from "@/features/public-pos/order/public-qr-scan-state";

describe("public QR scan state", () => {
  it("uses an attempt-specific request key for explicit retries", () => {
    expect(publicQrScanRequestKey(" token ", "en", 0)).toBe("token:en:0");
    expect(publicQrScanRequestKey(" token ", "en", 1)).toBe("token:en:1");
  });

  it("treats a new request key as idle without changing a terminal error", () => {
    const failedState = {
      requestKey: "token:en:0",
      status: PUBLIC_QR_SCAN_STATUS.ERROR,
    };

    expect(currentPublicQrScanStatus(failedState, "token:en:0")).toBe(
      PUBLIC_QR_SCAN_STATUS.ERROR,
    );
    expect(currentPublicQrScanStatus(failedState, "token:en:1")).toBe(
      PUBLIC_QR_SCAN_STATUS.IDLE,
    );
  });

  it("stops loading after an error and does not load without a token", () => {
    expect(
      isPublicQrScanLoading({
        hasToken: true,
        languageReady: true,
        storeLoading: false,
        status: PUBLIC_QR_SCAN_STATUS.ERROR,
      }),
    ).toBe(false);
    expect(
      isPublicQrScanLoading({
        hasToken: false,
        languageReady: true,
        storeLoading: false,
        status: PUBLIC_QR_SCAN_STATUS.IDLE,
      }),
    ).toBe(false);
  });
});
