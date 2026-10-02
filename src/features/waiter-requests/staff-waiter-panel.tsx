"use client";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bell, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";
import { useToastStore } from "@/stores/toast-store";
import { useWaiterUpdates } from "./use-waiter-updates";
export function StaffWaiterPanel({ branch }: { branch: string }) {
  const { t, i18n } = useTranslation();
  const storedRows = useWaiterRequestsStore((s) => s.staffRequests);
  const key = useWaiterRequestsStore((s) => s.staffKey);
  const rows = key === branch ? storedRows : [];
  const load = useWaiterRequestsStore((s) => s.loadStaff);
  const handle = useWaiterRequestsStore((s) => s.handle);
  const busy = useWaiterRequestsStore((s) => s.handling);
  const error = useWaiterRequestsStore((s) => s.staffError);
  const loading = useWaiterRequestsStore((s) => s.staffLoading);
  const toast = useToastStore((s) => s.show);
  const refresh = useCallback(() => {
    if (branch) void load(branch);
  }, [branch, load]);
  useEffect(refresh, [refresh]);
  useWaiterUpdates(branch, refresh);
  useEffect(() => {
    if (!branch) return;
    let known = new Set<string>();
    let initialized = false;
    return useWaiterRequestsStore.subscribe((state) => {
      if (state.staffKey !== branch || state.staffLoading || state.staffError)
        return;
      const ids = new Set(state.staffRequests.map((r) => r.request_uuid));
      if (initialized) {
        for (const row of state.staffRequests)
          if (!known.has(row.request_uuid))
            toast({
              title: `${t("waiter.title")} · ${
                row.table_name_la || row.table_name_eng || ""
              }`,
              description: [
                ...row.items.map(
                  (item) => `${t(`waiter.${item.kind}`)} ×${item.qty}`
                ),
                row.message,
              ]
                .filter(Boolean)
                .join(" · ")
                .slice(0, 120),
              tone: "info",
            });
      }
      known = ids;
      initialized = true;
    });
  }, [branch, t, toast]);
  if (!rows.length && !error) return null;
  return (
    <section
      aria-label={t("waiter.title")}
      className="z-10 shrink-0 border-b border-border bg-background p-3"
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4 text-primary" />
          {t("waiter.title")} ({rows.length})
        </p>
        <Button
          variant="ghost"
          size="icon"
          disabled={loading}
          onClick={refresh}
          aria-label={t("actions.tryAgain")}
        >
          <RefreshCcw className="size-4" />
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("waiter.failed")}
        </p>
      ) : null}
      <div className="flex max-h-48 gap-3 overflow-auto py-2">
        {rows.map((r) => (
          <article
            key={r.request_uuid}
            className="min-w-64 max-w-80 shrink-0 rounded-lg border border-primary/30 bg-primary/5 p-3"
          >
            <p className="font-semibold">
              {i18n.language === "en"
                ? r.table_name_eng || r.table_name_la
                : r.table_name_la || r.table_name_eng}{" "}
              · {t(`waiter.status${r.status}`)}
            </p>
            <p className="text-sm">
              {r.items
                .map((i) => `${t(`waiter.${i.kind}`)} ×${i.qty}`)
                .join(" · ")}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {r.message}
            </p>
            <time className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleTimeString(
                i18n.language === "en" ? "en-GB" : "lo-LA",
                { hour: "2-digit", minute: "2-digit" }
              )}
            </time>
            <div className="mt-2 flex gap-2">
              {r.status === 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => void handle(r.request_uuid, 1)}
                >
                  {t("waiter.accept")}
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={!!busy}
                onClick={() => void handle(r.request_uuid, 2)}
              >
                {t("waiter.complete")}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
