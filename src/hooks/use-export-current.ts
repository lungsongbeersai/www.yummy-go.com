"use client";

import { useLayoutEffect, useMemo } from "react";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { createExportScope, type ExportCurrentGuard } from "@/lib/export/export-scope";

function identity() {
  const auth = useAuthStore.getState();
  return JSON.stringify([auth.token, auth.user?.uuid, authStoreUuid(auth.user), auth.user?.branch_uuid, auth.user?.status, auth.user?.store_status]);
}

// Export preparation can outlive a route, filter, account or branch change.
// Capture this callback before awaiting data so a later native picker cannot
// save a report prepared for the previous view or authenticated session.
export function useExportCurrent(scopeKey: string): ExportCurrentGuard {
  const session = useAuthStore(state => JSON.stringify([state.token, state.user?.uuid, authStoreUuid(state.user), state.user?.branch_uuid, state.user?.status, state.user?.store_status]));
  const branch = useBranchStore(state => state.selectedBranchUuid);
  const owner = useMemo(() => createExportScope(scopeKey, () => session === identity()
    && branch === useBranchStore.getState().selectedBranchUuid), [scopeKey, session, branch]);
  // Invalidate the previous view during commit. Passive cleanup would leave
  // a window where an already-resolved native callback can save stale data.
  useLayoutEffect(() => owner.activate(), [owner]);
  return owner.isCurrent;
}
