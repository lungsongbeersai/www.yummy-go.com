"use client";

import { useEffect, useState } from "react";
import { useCommercialStore } from "@/stores/commercial-store";

export function useCommercialRouteScope(storeUuid?: string, branchUuid?: string) {
  const initialize = useCommercialStore((state) => state.initialize);
  const optionsLoading = useCommercialStore((state) => state.optionsLoading);
  const [prepared, setPrepared] = useState("");
  const requestKey = JSON.stringify([storeUuid, branchUuid]);
  useEffect(() => {
    let active = true;
    const prepare = async () => {
      // A new page can follow a role, token or login-branch change while owner
      // IDs stay the same. Reverify live scope instead of reusing cached options.
      await initialize({ storeUuid, branchUuid });
      // initialize can be superseded by a newer route. The old page must not
      // start detail reads or reset the newer page's shared workspace.
      if (active && !useCommercialStore.getState().optionsLoading) setPrepared(requestKey);
    };
    void prepare().catch(() => { if (active) setPrepared(requestKey); });
    return () => { active = false; };
  }, [storeUuid, branchUuid, requestKey, initialize]);
  return prepared === requestKey && !optionsLoading;
}
