"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { ChefHat, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/format";
import type { CustomerDisplayPayload } from "../shared/customer-display-sync";
import { CUSTOMER_DISPLAY_CHANNEL, CUSTOMER_DISPLAY_STORAGE_KEY } from "../shared/customer-display-sync";

export function CustomerDisplayPage() {
  const { t } = useTranslation();
  const [payload, setPayload] = useState<CustomerDisplayPayload | null>(null);

  useEffect(() => {
    function acceptPayload(data: unknown) {
      if (data && typeof data === "object") setPayload(data as CustomerDisplayPayload);
    }

    window.electronAPI?.signalReady();
    const unsubscribeElectron = window.electronAPI?.onDisplayMessage(acceptPayload);
    const storedPayload = window.localStorage.getItem(CUSTOMER_DISPLAY_STORAGE_KEY);

    if (storedPayload) {
      try {
        acceptPayload(JSON.parse(storedPayload));
      } catch {
        window.localStorage.removeItem(CUSTOMER_DISPLAY_STORAGE_KEY);
      }
    }

    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
    if (channel) {
      channel.onmessage = (event) => acceptPayload(event.data);
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CUSTOMER_DISPLAY_STORAGE_KEY || !event.newValue) return;
      try {
        acceptPayload(JSON.parse(event.newValue));
      } catch {
        window.localStorage.removeItem(CUSTOMER_DISPLAY_STORAGE_KEY);
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      unsubscribeElectron?.();
      channel?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const total = Number(payload?.grand_total ?? payload?.total ?? 0);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const summaryRows = [
    { label: t("pos.cartSubtotal"), value: Number(payload?.subtotal ?? 0) },
    { label: t("pos.discountTotal"), value: Number(payload?.discount ?? 0), discount: true },
    { label: t("pos.serviceTotal"), value: Number(payload?.service ?? 0) },
    { label: t("pos.vat"), value: Number(payload?.vat ?? 0) }
  ].filter((row) => row.value > 0);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#1f8f5f,#0d1724_45%,#070b12)] p-8 text-white">
      <div className="w-full max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/12">
              <ChefHat className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-black">Yummy Go</p>
              <p className="text-white/60">
                {payload?.table_name ? `${t("nav.table")}: ${payload.table_name}` : t("app.customerDisplay")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {payload?.invoice ? <Badge className="border-white/15 bg-white/15 text-white">{payload.invoice}</Badge> : null}
            <Monitor className="h-9 w-9 text-white/45" />
          </div>
        </div>

        <Card className="border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
          <CardContent className="grid gap-8 p-8 lg:grid-cols-[1fr_22rem]">
            <div>
              <p className="mb-4 text-sm font-bold uppercase text-emerald-200">{t("customerDisplay.currentOrder")}</p>
              <div className="flex flex-col gap-3">
                {items.length ? items.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_auto] gap-4 rounded-lg bg-white/10 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <CustomerDisplayItemMedia image={item.image} imageColor={item.imageColor} />
                      <div className="min-w-0">
                        <p className="truncate font-bold">{item.name}</p>
                        <p className="text-sm text-white/60">
                          {t("pos.qty")}: {item.qty}
                        </p>
                        {item.note ? <p className="mt-1 truncate text-xs text-amber-100">{item.note}</p> : null}
                      </div>
                    </div>
                    <div className="text-right font-black">
                      <p>{money(Number(item.total ?? 0))}</p>
                      {item.price ? <p className="text-sm font-bold text-white/50">{money(Number(item.price))}</p> : null}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg bg-white/10 p-8 text-center text-white/60">
                    {t("customerDisplay.waiting")}
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-white p-6 text-slate-950">
              <p className="text-sm font-bold uppercase text-slate-500">{t("common.total")}</p>
              <p className="mt-3 text-5xl font-black">{money(total)}</p>
              {summaryRows.length ? (
                <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-4 text-sm font-bold">
                  {summaryRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">{row.label}</span>
                      <span className={row.discount ? "text-red-600" : "text-slate-950"}>
                        {row.discount ? "-" : ""}{money(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="mt-6 text-sm text-slate-500">{t("customerDisplay.thanks")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function CustomerDisplayItemMedia({
  image,
  imageColor
}: {
  image?: string | null;
  imageColor?: string | null;
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={56}
        height={56}
        unoptimized
        className="size-14 rounded-lg bg-white/15 object-cover"
      />
    );
  }

  if (imageColor) {
    const style = { backgroundColor: imageColor } satisfies CSSProperties;

    return (
      <span
        className="size-14 shrink-0 rounded-lg border border-white/15 bg-white/15 shadow-inner"
        style={style}
        aria-hidden="true"
      />
    );
  }

  return null;
}
