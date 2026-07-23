import { describe, expect, it } from "vitest";
import {
  currentPublicQrScanStatus,
  initialPublicLanguageApplied,
  INITIAL_PUBLIC_QR_SCAN_STATE,
  isPublicQrScanLoading,
  PUBLIC_QR_SCAN_STATUS,
  publicQrScanRequestKey,
} from "@/features/public-pos/order/public-qr-scan-state";

describe("public QR scan state", () => {
  it("starts ready when hydration already matches the initial URL language", () => {
    expect(
      initialPublicLanguageApplied({
        activeLanguage: "en",
        hydrated: true,
        initialQueryLanguage: "en",
      }),
    ).toBe(true);
    expect(
      initialPublicLanguageApplied({
        activeLanguage: "la",
        hydrated: true,
        initialQueryLanguage: null,
      }),
    ).toBe(true);
    expect(
      initialPublicLanguageApplied({
        activeLanguage: "la",
        hydrated: false,
        initialQueryLanguage: "la",
      }),
    ).toBe(false);
    expect(
      initialPublicLanguageApplied({
        activeLanguage: "la",
        hydrated: true,
        initialQueryLanguage: "en",
      }),
    ).toBe(false);
  });

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
    expect(
      isPublicQrScanLoading({
        hasToken: true,
        languageReady: true,
        storeLoading: false,
        status: currentPublicQrScanStatus(failedState, "token:en:1"),
      }),
    ).toBe(true);
  });

  it("derives a missing-token request as an error without stored request state", () => {
    expect(
      currentPublicQrScanStatus(INITIAL_PUBLIC_QR_SCAN_STATE, "", false),
    ).toBe(PUBLIC_QR_SCAN_STATUS.ERROR);
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
