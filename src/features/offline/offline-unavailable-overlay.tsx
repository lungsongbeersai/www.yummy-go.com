"use client";

import { WifiOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import { mobileOfflineDisabledForCurrentBranch, useNetworkStore } from "@/stores/network-store";

// The owner asked for offline-to-online itself to be gated, not just a toast
// on individual actions: while this branch's mobile offline toggle is off,
// going offline must be as unmistakable and total as the browser's own
// "No internet" page — the whole app blocks, not just the action just tried.
// Non-dismissible; closes itself the moment networkState confirms ONLINE.
export function OfflineUnavailableOverlay() {
  const { t } = useTranslation();
  const networkState = useNetworkStore((state) => state.state);
  const isOffline = networkState === BACKEND_NETWORK_STATE.OFFLINE;
  const [capabilityDisabled, setCapabilityDisabled] = useState(false);

  useEffect(() => {
    if (!isOffline) return;
    let active = true;
    void mobileOfflineDisabledForCurrentBranch().then((disabled) => {
      if (active) setCapabilityDisabled(disabled);
    });
    return () => {
      active = false;
    };
  }, [isOffline]);

  return (
    <Dialog open={isOffline && capabilityDisabled}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden p-0"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="gap-0 border-b bg-muted/30 p-0 text-left">
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="grid size-12 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
              <WifiOffIcon className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-black">
                {t("offlineSync.branchOfflineBlockedTitle")}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {t("offlineSync.branchOfflineBlockedDescription")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
