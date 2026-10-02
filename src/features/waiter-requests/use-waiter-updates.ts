"use client";
import { useEffect } from "react";
import { subscribeWaiterRequests } from "@/lib/socket";
export function useWaiterUpdates(
  branch: string,
  refresh: () => void,
  table?: string
) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    };
    const unsubscribe = subscribeWaiterRequests(branch, (p) => {
      if (
        p.branch_uuid_fk !== branch ||
        (table && p.table_uuid && p.table_uuid !== table)
      )
        return;
      schedule();
    });
    const visible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [branch, refresh, table]);
}
