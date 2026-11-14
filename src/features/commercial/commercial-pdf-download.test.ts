import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMERCIAL_PDF_TRANSFER_LIFETIME_MS, createCommercialPdfLease } from "./commercial-pdf-download";

const pdf = () => new File(["%PDF-synthetic"], "sample.pdf", { type: "application/pdf" });
let nextUrl = 0;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:synthetic-${++nextUrl}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("commercial PDF resource leases", () => {
  it("immediately releases a prepared file that was never explicitly opened or downloaded", async () => {
    const stop = vi.fn();
    const lease = createCommercialPdfLease(pdf(), { owner: {}, watchIdentity: () => stop });
    lease.release();
    await lease.released;
    expect(lease.isAvailable()).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(lease.url);
    expect(stop).toHaveBeenCalledOnce();
  });

  it("preserves explicit exports after the dialog closes, with a five-minute nonrenewable limit", () => {
    const lease = createCommercialPdfLease(pdf(), { owner: {} });
    expect(lease.transfer()).toBe(true);
    lease.release();
    vi.advanceTimersByTime(COMMERCIAL_PDF_TRANSFER_LIFETIME_MS - 1);
    expect(lease.isAvailable()).toBe(true);
    expect(lease.transfer()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(lease.isAvailable()).toBe(false);
    expect(lease.transfer()).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(lease.url);
  });

  it("caps handed-off resources at two per document without evicting another document's resource", () => {
    const owner = {};
    const first = createCommercialPdfLease(pdf(), { owner });
    const other = createCommercialPdfLease(pdf(), { owner: {} });
    first.transfer(); other.transfer();
    const second = createCommercialPdfLease(pdf(), { owner }); second.transfer();
    const third = createCommercialPdfLease(pdf(), { owner }); third.transfer();
    expect(first.isAvailable()).toBe(false);
    expect(second.isAvailable()).toBe(true);
    expect(third.isAvailable()).toBe(true);
    expect(other.isAvailable()).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(first.url);
  });

  it("revokes even a handed-off resource on identity invalidation after the output has closed", () => {
    let invalidate: () => void = () => {};
    const stop = vi.fn();
    const lease = createCommercialPdfLease(pdf(), { owner: {}, watchIdentity: callback => { invalidate = callback; return stop; } });
    lease.transfer(); lease.release(); invalidate();
    expect(lease.isAvailable()).toBe(false);
    expect(stop).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(lease.url);
    vi.advanceTimersByTime(COMMERCIAL_PDF_TRANSFER_LIFETIME_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("blocks stale preparation and stale ready-anchor clicks before handing off a resource", () => {
    expect(() => createCommercialPdfLease(pdf(), { owner: {}, isCurrent: () => false })).toThrowError("cancelled");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    let current = true;
    const lease = createCommercialPdfLease(pdf(), { owner: {}, isCurrent: () => current });
    current = false;
    expect(lease.transfer()).toBe(false);
    expect(lease.isAvailable()).toBe(false);
  });

  it("cleans up if identity subscription setup fails or immediately invalidates", () => {
    expect(() => createCommercialPdfLease(pdf(), { owner: {}, watchIdentity: () => { throw new Error("subscription unavailable"); } })).toThrow("subscription unavailable");
    const stop = vi.fn();
    const lease = createCommercialPdfLease(pdf(), { owner: {}, watchIdentity: invalidate => { invalidate(); return stop; } });
    expect(lease.isAvailable()).toBe(false);
    expect(stop).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
