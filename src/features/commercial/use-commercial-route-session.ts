"use client";

import { useEffect } from "react";
import { useCommercialStore } from "@/stores/commercial-store";

export function useCommercialRouteSession(routeKey: string) {
  const enterRoute = useCommercialStore((state) => state.enterRoute);
  const leaveRoute = useCommercialStore((state) => state.leaveRoute);
  useEffect(() => {
    const lease = enterRoute();
    return () => leaveRoute(lease);
  }, [routeKey, enterRoute, leaveRoute]);
}
