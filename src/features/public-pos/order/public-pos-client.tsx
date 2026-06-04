"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { ProductBrowse } from "@/features/public-pos/order/components/product-browse";
import { PublicHeader } from "@/features/public-pos/order/components/public-header";
import { PublicPosLoadingScreen } from "@/features/public-pos/order/components/public-pos-skeletons";
import { usePublicPosBootstrap } from "@/features/public-pos/order/hooks/use-public-pos-bootstrap";

export function PublicPosClient({
  token,
  queryLang,
}: {
  token: string;
  queryLang: string | null;
}) {
  const { t } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const [cartOpen, setCartOpen] = useState(false);
  const {
    activeLanguage,
    cartQty,
    error,
    isPublicLoading,
    languageReady,
    qrDisabled,
    statusLabel,
    table,
  } = usePublicPosBootstrap({ token, queryLang, t });
  const errorTitle =
    table && !qrDisabled ? t("pos.productLoadFailed") : t("pos.qrScanFailed");
  const canOrder = Boolean(table && !qrDisabled && !isPublicLoading);

  return (
    <main className="min-h-screen bg-[#f3fbf7] pb-[calc(4rem+env(safe-area-inset-bottom))] text-slate-950 dark:bg-app dark:text-foreground">
      <PublicHeader
        table={table}
        statusLabel={statusLabel}
        theme={theme}
        cartQty={cartQty}
        canOpenCart={canOrder}
        onToggleTheme={toggleTheme}
        onOpenCart={() => setCartOpen(true)}
      />

      <div className="mx-auto w-full max-w-5xl px-2.5 py-2 sm:px-4 sm:py-3">
        <section
          className={cn(
            "flex w-full flex-col gap-3",
            !table || isPublicLoading
              ? "mx-auto min-h-[calc(100dvh-130px)] max-w-2xl justify-center"
              : "",
          )}
        >
          {isPublicLoading ? <PublicPosLoadingScreen /> : null}

          {languageReady && !isPublicLoading && error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{errorTitle}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {languageReady && !isPublicLoading && qrDisabled ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{t("pos.qrDisabled")}</AlertTitle>
              <AlertDescription>
                {t("pos.qrDisabledDescription")}
              </AlertDescription>
            </Alert>
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
