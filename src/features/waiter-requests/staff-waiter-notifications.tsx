"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAlertSoundPlayer } from "@/hooks/use-alert-sound-player";
import type { BranchRealtimePayload } from "@/lib/socket";
import type { WaiterRequest } from "@/services/waiter-requests";
import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";
import { createStaffRequestAlertTracker } from "./staff-request-alerts";
import { StaffWaiterPanel } from "./staff-waiter-panel";
import { useWaiterUpdates } from "./use-waiter-updates";

export function StaffWaiterNotifications() {
  const branch = useAuthStore((state) => state.user?.branch_uuid ?? "");
  return branch ? <BranchWaiterNotifications key={branch} branch={branch} /> : null;
}

function BranchWaiterNotifications({ branch }: { branch: string }) {
  const { t, i18n } = useTranslation();
  const [tracker] = useState(() => createStaffRequestAlertTracker(branch));
  const load = useWaiterRequestsStore((state) => state.loadStaff);
  const open = useWaiterRequestsStore((state) => state.staffPanelOpen);
  const setOpen = useWaiterRequestsStore((state) => state.setStaffPanelOpen);
  const playAlertSound = useAlertSoundPlayer("waiter");
  const show = useToastStore((state) => state.show);
  const refresh = useCallback(() => { void load(branch); }, [branch, load]);
  const recordEvent = useCallback(
    (event: BranchRealtimePayload) => tracker.recordEvent(event),
    [tracker]
  );

  const notify = useEffectEvent((rows: WaiterRequest[]) => {
    if (!rows.length) return;
    // A burst of calls plays once, while each table retains its own actionable toast.
    playAlertSound();
    for (const row of rows) {
      const tableName = i18n.language === "en"
        ? row.table_name_eng || row.table_name_la
        : row.table_name_la || row.table_name_eng;
      show({
        id: `waiter-${row.request_uuid}`,
        title: `${t("waiter.title")} · ${tableName || ""}`,
        description: [
          ...row.items.map((item) => `${t(`waiter.${item.kind}`)} ×${item.qty}`),
          row.message,
        ].filter(Boolean).join(" · ").slice(0, 120),
        tone: "info",
        action: { label: t("waiter.viewRequests"), onClick: () => setOpen(true) },
      });
    }
  });

  useWaiterUpdates(branch, refresh, undefined, recordEvent);
  useEffect(() => {
    const inspect = (state: ReturnType<typeof useWaiterRequestsStore.getState>) => {
      notify(tracker.consume(state));
    };
    // Subscribe before loading, and seed from already loaded state so the first new call
    // after a shell remount cannot accidentally become a silent baseline.
    const unsubscribe = useWaiterRequestsStore.subscribe(inspect);
    inspect(useWaiterRequestsStore.getState());
    refresh();
    return unsubscribe;
  }, [refresh, tracker]);

  return <StaffWaiterPanel branch={branch} open={open} onOpenChange={setOpen} />;
}
