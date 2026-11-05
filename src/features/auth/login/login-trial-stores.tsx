"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Beef, Beer, Coffee, FlaskConical, Martini, Soup, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    <Card className="min-h-0 min-w-0 gap-0 rounded-none py-0 shadow-none ring-0 lg:absolute lg:inset-0" aria-labelledby="login-trial-title">
      <CardHeader className="shrink-0 gap-3 rounded-none border-b bg-muted/30 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FlaskConical aria-hidden className="size-4" />
          </span>
          <CardTitle id="login-trial-title" className="font-lao text-base font-semibold">{t("auth.trial.title")}</CardTitle>
        </div>
        <CardDescription id="login-trial-description" className="font-lao text-xs leading-relaxed">{t("auth.trial.description")}</CardDescription>
      </CardHeader>
      <CardContent
        id="login-trial-list"
        role="region"
        tabIndex={0}
        aria-labelledby="login-trial-title"
        aria-describedby="login-trial-description"
        className="min-h-0 max-h-80 overflow-y-auto overscroll-y-contain p-3 [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring lg:max-h-none lg:flex-1"
      >
        {!hydrated || listLoading ? (
          <div className="grid gap-2" aria-busy="true" aria-label={t("auth.trial.loading")}>
            {[0, 1, 2].map((index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
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
          <div className="grid gap-2 p-1">
            {stores.map((store) => {
              const Icon = categoryIcons[store.store_category];
              const name = (i18n.language.startsWith("en") ? store.store_name_eng : store.store_name_la)
                || store.store_name_la || store.store_name_eng || t("auth.trial.demo");
              const entering = authLoading && activeStoreUuid === store.store_uuid;
              return (
                <Button
                  key={store.store_uuid}
                  type="button"
                  variant="outline"
                  className="relative h-auto min-h-20 w-full min-w-0 justify-start gap-3 rounded-xl bg-background p-3 text-left whitespace-normal hover:border-primary/40 hover:bg-primary/5 focus-visible:border-primary"
                  disabled={!hydrated || authLoading || isLoggedIn}
                  aria-label={t("auth.trial.enterStore", { name })}
                  aria-busy={entering}
                  onClick={() => void tryStore(store.store_uuid)}
                >
                  <Avatar size="lg">
                    {store.store_logo ? <AvatarImage src={getStoreLogoUrl(store.store_logo)} alt="" /> : null}
                    <AvatarFallback><Icon aria-hidden className="size-5" /></AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 font-lao">
                    <span className="break-words text-sm leading-relaxed font-semibold">{name}</span>
                    <span className="text-xs leading-relaxed font-normal text-muted-foreground">{t(`settings.storeBranch.categories.${store.store_category}`)}</span>
                    <span className="sr-only" aria-live="polite">{entering ? t("auth.signingIn") : null}</span>
                  </span>
                  <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {entering ? <Spinner className="size-3.5" /> : <ArrowRight className="size-3.5" />}
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
