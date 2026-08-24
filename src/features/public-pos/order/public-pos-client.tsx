"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { ProductBrowse } from "@/features/public-pos/order/components/product-browse";
import { PublicHeader } from "@/features/public-pos/order/components/public-header";
import { PublicPosLoadingScreen } from "@/features/public-pos/order/components/public-pos-skeletons";
import { usePublicPosBootstrap } from "@/features/public-pos/order/hooks/use-public-pos-bootstrap";
import { usePublicPosThemeScope } from "@/features/public-pos/order/hooks/use-public-pos-theme-scope";
import { DEFAULT_PUBLIC_POS_ACCENT } from "@/features/public-pos/order/constants";
import {
  readPublicPosAccent,
  subscribePublicPosAccent,
  writePublicPosAccent,
} from "@/features/public-pos/order/public-pos-accent";
import type { PublicPosAccent } from "@/features/public-pos/order/types";

export function PublicPosClient({
  token,
  queryLang,
  fontClassName,
}: {
  token: string;
  queryLang: string | null;
  fontClassName: string;
}) {
  const { t } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const [cartOpen, setCartOpen] = useState(false);
  // server render ใช้ค่าตั้งต้นเสมอ ฝั่ง client sync จาก localStorage โดยไม่มี effect
  // แพตเทิร์นเดียวกับปุ่มสลับ grid/list
  const accent = useSyncExternalStore(
    subscribePublicPosAccent,
    readPublicPosAccent,
    (): PublicPosAccent => DEFAULT_PUBLIC_POS_ACCENT,
  );
  const {
    activeLanguage,
    canRetryScan,
    cartQty,
    error,
    isPublicLoading,
    languageReady,
    qrDisabled,
    statusLabel,
    table,
    retryScan,
  } = usePublicPosBootstrap({ token, queryLang, t });
  const errorTitle =
    table && !qrDisabled ? t("pos.productLoadFailed") : t("pos.qrScanFailed");
  const canOrder = Boolean(table && !qrDisabled && !isPublicLoading);
  usePublicPosThemeScope(fontClassName, accent);

  return (
    <main
      data-yg-menu=""
      data-yg-accent={accent}
      className={cn(
        fontClassName,
        "yg-shell relative min-h-dvh font-yg-sans text-yg-ink antialiased",
        "pb-[calc(7.5rem+env(safe-area-inset-bottom))]",
      )}
    >
      <ShellAmbience />

      <div className="relative mx-auto flex w-full max-w-280 flex-col gap-[clamp(20px,3.2vw,32px)] px-(--yg-gutter) pt-[clamp(16px,3.4vw,34px)]">
        <PublicHeader
          table={table}
          statusLabel={statusLabel}
          theme={theme}
          accent={accent}
          cartQty={cartQty}
          canOpenCart={canOrder}
          onAccentChange={writePublicPosAccent}
          onToggleTheme={toggleTheme}
          onOpenCart={() => setCartOpen(true)}
        />

        <section
          className={cn(
            "flex w-full flex-col gap-3",
            !table || isPublicLoading
              ? "mx-auto min-h-[calc(100dvh-220px)] max-w-2xl justify-center"
              : "",
          )}
        >
          {isPublicLoading ? <PublicPosLoadingScreen /> : null}

          {languageReady && !isPublicLoading && error ? (
            <PublicPosAlert
              title={errorTitle}
              description={error}
              actionLabel={canRetryScan ? t("actions.tryAgain") : ""}
              onAction={retryScan}
            />
          ) : null}

          {languageReady && !isPublicLoading && qrDisabled ? (
            <PublicPosAlert
              title={t("pos.qrDisabled")}
              description={t("pos.qrDisabledDescription")}
            />
          ) : null}

          {canOrder ? (
            <ProductBrowse
              token={token}
              lang={activeLanguage}
              cartOpen={cartOpen}
              onCartOpenChange={setCartOpen}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

/** แสงพื้นหลังสองก้อนตามดีไซน์ — ตรึงกับ viewport และคลิปในตัวเอง
 *  เพื่อไม่ให้ต้องใส่ overflow:hidden ที่ shell ซึ่งจะทำให้ sticky ของแถบหมวดตาย */
function ShellAmbience() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* ก้อนนี้ scale/opacity เคลื่อนไหวตลอดเวลาที่หน้าเปิดอยู่ — blur filter บนอิลิเมนต์ที่
          animate transform ทำให้เบราว์เซอร์ต้อง re-rasterize blur ใหม่ทุกเฟรม (แพงบน mobile GPU)
          ตัด blur ออก ใช้ soft fade จาก radial-gradient เองแทน (transparent 66%) หน้าตาแทบไม่ต่าง */}
      <div
        className="yg-glow-orb absolute top-[-14%] right-[-6%] h-[min(60vw,540px)] w-[min(60vw,540px)] rounded-full"
        style={{
          background: "radial-gradient(circle, var(--yg-glow1), transparent 66%)",
        }}
      />
      <div
        className="absolute bottom-[4%] left-[-12%] h-[min(55vw,460px)] w-[min(55vw,460px)] rounded-full blur-[26px]"
        style={{
          background: "radial-gradient(circle, var(--yg-glow2), transparent 68%)",
        }}
      />
    </div>
  );
}

function PublicPosAlert({
  title,
  description,
  actionLabel = "",
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Alert className="border-destructive/40 bg-destructive/10 text-yg-ink backdrop-blur-md">
      <AlertCircle className="text-destructive" />
      <AlertTitle className="font-yg-serif text-base font-semibold">
        {title}
      </AlertTitle>
      <AlertDescription className="text-yg-muted">
        <p>{description}</p>
        {actionLabel ? (
          <Button
            type="button"
            onClick={onAction}
            className="mt-2 h-11 rounded-xl border border-yg-accent-line bg-yg-accent-soft px-4 text-xs font-extrabold text-yg-accent-strong transition-[filter,transform] hover:bg-yg-accent-soft hover:brightness-110 focus-visible:ring-yg-accent focus-visible:ring-offset-yg-bg motion-reduce:transition-none"
          >
            {actionLabel}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
