"use client";

import { useEffect } from "react";

const OFFLINE_BROWSER_DB_NAME = "yummy-go-browser-offline-v1";

const OFFLINE_STORAGE_KEYS = new Set([
  "yummy-go:offline-sync-device",
]);

const OFFLINE_STORAGE_PREFIXES = [
  "yummy-go-local-recovery:",
  "yummy-go-blocked-notice:",
];

function clearOfflineStorage(storage: Storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => Boolean(key));
  for (const key of keys) {
    if (
      OFFLINE_STORAGE_KEYS.has(key) ||
      OFFLINE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      storage.removeItem(key);
    }
  }
}

export async function retireBrowserOfflineState() {
  clearOfflineStorage(window.localStorage);
  clearOfflineStorage(window.sessionStorage);

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  }

  if (typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(OFFLINE_BROWSER_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Offline database cleanup failed"));
      // Another old tab can still hold the database open. Do not block the new
      // online app; the pending delete completes when that tab closes and every
      // subsequent launch requests the same idempotent deletion again.
      request.onblocked = () => resolve();
    });
  }
}

export function OnlineOnlyCutoverRuntime() {
  useEffect(() => {
    void retireBrowserOfflineState().catch((error: unknown) => {
      console.warn("[ONLINE_ONLY] browser offline cleanup will retry on next launch", error);
    });
  }, []);

  return null;
}
