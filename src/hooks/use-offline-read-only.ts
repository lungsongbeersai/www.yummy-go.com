"use client";

import { useAuthStore } from "@/stores/auth-store";

/**
 * True while the app is in its confirmed offline session.
 *
 * Master-data pages are readable offline because the Local Agent projects them
 * from its own SQLite, but their create/update/delete routes are deliberately
 * absent from OFFLINE_ROUTES: there is no conflict policy for editing master
 * data on a device that cannot see the server. Screens use this to take those
 * controls away rather than let a cashier press them and collect an error.
 *
 * Reads `offlineSession` — the same flag AuthGuard gates pages on — so a page
 * and its buttons can never disagree about whether the app is offline.
 */
export function useOfflineReadOnly(): boolean {
  return useAuthStore((state) => state.offlineSession);
}
