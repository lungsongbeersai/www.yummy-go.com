"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Beef, Beer, Coffee, FlaskConical, Martini, Soup, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getStoreLogoUrl } from "@/lib/image";
import type { StoreCategory } from "@/lib/store-category";
import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";

const categoryIcons: Record<StoreCategory, LucideIcon> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  mala: Beef,
  pho: Soup,
  pub: Beer,
  bar: Martini,
};

export function LoginTrialStores() {
  const { t, i18n } = useTranslation();
  const stores = useAuthStore((state) => state.trialStores);
  const listLoading = useAuthStore((state) => state.trialStoresLoading);
  const listError = useAuthStore((state) => state.trialStoresError);
  const load = useAuthStore((state) => state.loadTrialStores);
  const login = useAuthStore((state) => state.loginWithTrialStore);
  const authLoading = useAuthStore((state) => state.loading);
  const activeStoreUuid = useAuthStore((state) => state.activeTrialStoreUuid);
  const hydrated = useAuthStore((state) => state.hydrated);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const showToast = useToastStore((state) => state.show);

  useEffect(() => {
    if (hydrated && !isLoggedIn) void load();
  }, [hydrated, isLoggedIn, load]);

  async function tryStore(storeUuid: string) {
    if (useAuthStore.getState().loading) return;
    try {
      const user = await login(storeUuid);
      if (user) showToast({ title: t("auth.trial.welcome"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("auth.trial.loginFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error",
      });
      void load();
    }
  }

  return (
    <Card className="rounded-2xl shadow-lg" aria-labelledby="login-trial-title">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle id="login-trial-title" className="font-lao text-lg">{t("auth.trial.title")}</CardTitle>
          <Badge variant="secondary"><FlaskConical aria-hidden />{t("settings.storeBranch.test")}</Badge>
        </div>
        <CardDescription className="font-lao">{t("auth.trial.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!hydrated || listLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={t("auth.trial.loading")}>
            {[0, 1, 2].map((index) => <Skeleton key={index} className="h-32 rounded-xl" />)}
          </div>
        ) : listError ? (
          <Alert>
            <AlertTitle>{t("auth.trial.loadFailed")}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{t("auth.trial.loadFailedHint")}</span>
              <Button variant="outline" className="min-h-11" onClick={() => void load()}>{t("auth.trial.retry")}</Button>
            </AlertDescription>
          </Alert>
        ) : stores.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FlaskConical aria-hidden /></EmptyMedia>
              <EmptyTitle>{t("auth.trial.empty")}</EmptyTitle>
              <EmptyDescription>{t("auth.trial.emptyHint")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => {
              const Icon = categoryIcons[store.store_category];
              const name = (i18n.language.startsWith("en") ? store.store_name_eng : store.store_name_la)
                || store.store_name_la || store.store_name_eng || t(`settings.storeBranch.categories.${store.store_category}`);
              const entering = authLoading && activeStoreUuid === store.store_uuid;
              return (
                <Button
                  key={store.store_uuid}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-32 w-full min-w-0 items-start justify-start gap-3 rounded-xl p-4 text-left whitespace-normal"
                  disabled={!hydrated || authLoading || isLoggedIn}
                  aria-label={t("auth.trial.enterStore", { name })}
                  aria-busy={entering}
                  onClick={() => void tryStore(store.store_uuid)}
                >
                  <Avatar size="lg">
                    {store.store_logo ? <AvatarImage src={getStoreLogoUrl(store.store_logo)} alt="" /> : null}
                    <AvatarFallback><Icon aria-hidden className="size-5" /></AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 font-lao">
                    <span className="text-xs font-normal text-muted-foreground">{t(`settings.storeBranch.categories.${store.store_category}`)}</span>
                    <span className="break-words font-semibold">{name}</span>
                    {store.branch_name ? <span className="break-words text-xs font-normal text-muted-foreground">{store.branch_name}</span> : null}
                    <span className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary" aria-live="polite">
                      {entering ? <Spinner /> : <ArrowRight aria-hidden className="size-4" />}
                      {entering ? t("auth.signingIn") : t("auth.trial.enter")}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
