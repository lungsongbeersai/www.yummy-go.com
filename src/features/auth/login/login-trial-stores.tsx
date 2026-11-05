"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Beef, Beer, ChevronLeft, ChevronRight, Coffee, FlaskConical, Martini, Soup, UsersRound, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getStoreLogoUrl } from "@/lib/image";
import type { StoreCategory } from "@/lib/store-category";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";
import { useTrialCarousel } from "./use-trial-carousel";

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
  const listReady = hydrated && !listLoading && !listError && stores.length > 0;
  const { scrollRef, activeIndex, goToSlide, onKeyDown } = useTrialCarousel(stores.length, listReady);

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
    <Card className="min-h-0 min-w-0 gap-0 rounded-none bg-muted/30 py-0 shadow-none ring-0 lg:absolute lg:inset-0" aria-labelledby="login-trial-title">
      <CardHeader className="shrink-0 gap-3 rounded-none border-b p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FlaskConical aria-hidden className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col items-start gap-1">
            <Badge variant="outline" className="border-primary/20 bg-background text-primary">{t("auth.trial.label")}</Badge>
            <CardTitle id="login-trial-title" role="heading" aria-level={2} className="font-lao text-lg font-semibold">{t("auth.trial.title")}</CardTitle>
          </div>
        </div>
        <CardDescription id="login-trial-description" className="font-lao text-xs leading-relaxed">{t("auth.trial.description")}</CardDescription>
      </CardHeader>
      <CardContent
        ref={scrollRef}
        id="login-trial-list"
        role="region"
        tabIndex={0}
        aria-labelledby="login-trial-title"
        aria-describedby="login-trial-description"
        onKeyDown={onKeyDown}
        className="min-h-0 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-px-4 p-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring max-lg:no-scrollbar lg:flex-1 lg:snap-none lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-y-contain lg:scroll-px-0 lg:[scrollbar-gutter:stable]"
      >
        {!hydrated || listLoading ? (
          <div className="grid grid-flow-col auto-cols-[calc(100%_-_1.5rem)] gap-3 p-1 lg:grid-flow-row lg:auto-cols-auto" aria-busy="true" aria-label={t("auth.trial.loading")}>
            {[0, 1, 2].map((index) => <Skeleton key={index} className="h-40 rounded-xl" />)}
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
          <div className={cn("grid grid-flow-col auto-rows-fr gap-3 p-1 lg:grid-flow-row lg:auto-cols-auto", stores.length > 1 ? "auto-cols-[calc(100%_-_1.5rem)]" : "auto-cols-fr")}>
            {stores.map((store) => {
              const Icon = categoryIcons[store.store_category];
              const name = (i18n.language.startsWith("en") ? store.store_name_eng : store.store_name_la)
                || store.store_name_la || store.store_name_eng || t("auth.trial.demo");
              const entering = authLoading && activeStoreUuid === store.store_uuid;
              return (
                <Card key={store.store_uuid} data-trial-slide="" className="h-full min-h-40 min-w-0 snap-start gap-3 rounded-xl p-3 shadow-sm">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar size="lg">
                      {store.store_logo ? <AvatarImage src={getStoreLogoUrl(store.store_logo)} alt="" /> : null}
                      <AvatarFallback><Icon aria-hidden className="size-5" /></AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 font-lao">
                      <span title={name} className="line-clamp-2 break-words text-sm leading-relaxed font-semibold">{name}</span>
                      <span className="text-xs leading-relaxed text-muted-foreground">{t(`settings.storeBranch.categories.${store.store_category}`)}</span>
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-auto h-auto min-h-11 w-full shrink-0 justify-between gap-2 rounded-lg border-primary/25 bg-primary/5 px-3 py-2 font-lao text-xs font-semibold whitespace-normal text-primary hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    disabled={!hydrated || authLoading || isLoggedIn}
                    aria-label={t("auth.trial.enterStore", { name })}
                    aria-busy={entering}
                    onClick={() => void tryStore(store.store_uuid)}
                  >
                    <span aria-live="polite">{entering ? t("auth.signingIn") : t("auth.trial.enter")}</span>
                    {entering ? <Spinner aria-hidden className="size-4" /> : <ArrowRight aria-hidden className="size-4" />}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
      <CardFooter className="shrink-0 flex-col items-stretch gap-3 rounded-none border-t px-4 py-3 font-lao text-xs text-muted-foreground">
        {listReady && stores.length > 1 ? (
          <div role="group" aria-label={t("auth.trial.carousel")} className="flex items-center justify-between gap-3 lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0 rounded-full bg-background"
              aria-label={t("auth.trial.previous")}
              aria-controls="login-trial-list"
              disabled={activeIndex === 0}
              onClick={() => goToSlide(activeIndex - 1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p aria-live="polite" aria-atomic="true" className="font-semibold text-foreground tabular-nums">{t("auth.trial.position", { current: activeIndex + 1, total: stores.length })}</p>
              <p className="mt-0.5 leading-relaxed">{t("auth.trial.swipeHint")}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0 rounded-full bg-background"
              aria-label={t("auth.trial.next")}
              aria-controls="login-trial-list"
              disabled={activeIndex === stores.length - 1}
              onClick={() => goToSlide(activeIndex + 1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <UsersRound aria-hidden className="size-3.5 shrink-0" />
          <span>{t("auth.trial.sharedData")}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
