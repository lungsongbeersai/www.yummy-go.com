"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/common/loading-state";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { useToastStore } from "@/stores/toast-store";

export function CounterCheckoutPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const zones = usePosStore((state) => state.zones);
  const loading = usePosStore((state) => state.loading);
  const loadTables = usePosStore((state) => state.loadTables);
  const showToast = useToastStore((state) => state.show);

  async function load() {
    if (!user?.branch_uuid) return;
    try {
      await loadTables({ branch_uuid_fk: user.branch_uuid, lang: language });
    } catch (error) {
      showToast({ title: t("pos.failedTables"), description: error instanceof Error ? error.message : "", tone: "error" });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, user?.branch_uuid]);

  if (loading) return <LoadingState label={t("pos.loadingTables")} variant="grid" />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-primary">{t("pos.counterCheckout")}</p>
          <h1 className="text-2xl font-black">{t("pos.tables")}</h1>
          <p className="text-sm text-muted-foreground">{t("pos.subtitleTables")}</p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCcw className="h-4 w-4" />
          {t("actions.refresh")}
        </Button>
      </div>
      <div className="flex flex-col gap-5">
        {zones.map((zone) => (
          <section key={zone.zone_uuid}>
            <h2 className="mb-2 text-sm font-black uppercase text-muted-foreground">{zone.zone_name}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {(zone.tables ?? []).map((table) => (
                <Link
                  key={table.table_uuid}
                  href={`/sales/open-table-sale?table_uuid=${table.table_uuid}&table_name=${encodeURIComponent(table.table_name)}`}
                >
                  <Card className="transition hover:border-primary hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-black">{table.table_name}</p>
                        <Badge>{table.table_status === 2 ? t("common.busy") : t("common.free")}</Badge>
                      </div>
                      {table.customer_order_state ? (
                        <p className="mt-3 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
                          {t("pos.customerUpdate")}
                        </p>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">{t("pos.openTableHint")}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
