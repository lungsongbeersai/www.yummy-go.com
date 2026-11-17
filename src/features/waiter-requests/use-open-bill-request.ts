"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createMutationUuid } from "@/lib/pos/mutation-identity";
import type { WaiterRequest } from "@/services/waiter-requests";
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";
import { createSessionGuard } from "@/stores/session-store-registry";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";
import { billRequestOrderUrl, getActiveBillRequest } from "./bill-request-navigation";

export function useOpenBillRequest(branch: string, onOpenChange: (open: boolean) => void) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const runGuardedNavigation = useNavigationGuardStore((state) => state.run);
  const handle = useWaiterRequestsStore((state) => state.handle);

  return useCallback((request: WaiterRequest) => {
    const currentSession = createSessionGuard();
    const requestId = request.request_uuid.trim();
    if (!getActiveBillRequest(requestId, branch, useWaiterRequestsStore.getState())) return;

    runGuardedNavigation(() => {
      if (!currentSession()) return;
      const active = getActiveBillRequest(requestId, branch, useWaiterRequestsStore.getState());
      if (!active) return;

      void (async () => {
        if (active.status === 0) {
          const accepted = await handle(active.request_uuid.trim(), 1);
          if (!currentSession() || useWaiterRequestsStore.getState().staffKey !== branch) return;
          if (!accepted) {
            onOpenChange(true);
            return;
          }
        }

        if (!currentSession()) return;
        const latestSnapshot = useWaiterRequestsStore.getState();
        const latest = getActiveBillRequest(requestId, branch, latestSnapshot);
        if (!latest) {
          if (latestSnapshot.staffKey === branch && latestSnapshot.staffError) onOpenChange(true);
          return;
        }
        const target = billRequestOrderUrl(latest, i18n.language, createMutationUuid());
        if (!target) return;
        onOpenChange(false);
        router.push(target);
      })();
    });
  }, [branch, handle, i18n.language, onOpenChange, router, runGuardedNavigation]);
}
