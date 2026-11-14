"use client";

export interface CommercialPdfDownload {
  dispose: () => void;
  released: Promise<void>;
}

export interface CommercialPdfLease extends CommercialPdfDownload {
  url: string;
  isAvailable: () => boolean;
  transfer: () => boolean;
  release: () => void;
}

interface CommercialPdfLeaseOptions {
  isCurrent?: () => boolean;
  watchIdentity?: (invalidate: () => void) => () => void;
  owner?: object;
}

export const COMMERCIAL_PDF_TRANSFER_LIFETIME_MS = 5 * 60_000;
const transferredByOwner = new WeakMap<object, Set<CommercialPdfLease>>();

/** Keep an explicitly opened/saved PDF usable while the browser finishes its handoff. */
export function createCommercialPdfLease(file: File, { isCurrent = () => true, watchIdentity, owner = document }: CommercialPdfLeaseOptions = {}): CommercialPdfLease {
  if (!isCurrent()) throw new DOMException("Document export cancelled", "AbortError");
  const url = URL.createObjectURL(file);
  let active = true;
  let transferred = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopWatching: (() => void) | undefined;
  let resolveReleased: () => void = () => {};
  const released = new Promise<void>(resolve => { resolveReleased = resolve; });
  const owned = transferredByOwner.get(owner) ?? new Set<CommercialPdfLease>();
  transferredByOwner.set(owner, owned);
  const lease: CommercialPdfLease = {
    url,
    released,
    isAvailable: () => active,
    dispose: () => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      stopWatching?.();
      owned.delete(lease);
      URL.revokeObjectURL(url);
      resolveReleased();
    },
    release: () => { if (!transferred) lease.dispose(); },
    transfer: () => {
      if (!active) return false;
      if (!isCurrent()) { lease.dispose(); return false; }
      if (!transferred) {
        transferred = true;
        owned.add(lease);
        while (owned.size > 2) owned.values().next().value?.dispose();
        timer = setTimeout(lease.dispose, COMMERCIAL_PDF_TRANSFER_LIFETIME_MS);
      }
      return true;
    },
  };
  try {
    stopWatching = watchIdentity?.(lease.dispose);
    if (!active) stopWatching?.();
    return lease;
  } catch (error) {
    lease.dispose();
    throw error;
  }
}

/** Compatibility for callers that already hold a ready File in the current task. */
export function downloadCommercialPdfFile(file: File, isCurrent: () => boolean = () => true): CommercialPdfDownload {
  const lease = createCommercialPdfLease(file, { isCurrent });
  const link = document.createElement("a");
  link.href = lease.url;
  link.download = file.name;
  try {
    document.body.append(link);
    if (!lease.transfer()) throw new DOMException("Document export cancelled", "AbortError");
    link.click();
    return lease;
  } catch (error) {
    lease.dispose();
    throw error;
  } finally { link.remove(); }
}
