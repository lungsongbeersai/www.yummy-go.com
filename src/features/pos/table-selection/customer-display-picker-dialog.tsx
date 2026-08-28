"use client";

import { ExternalLink, Monitor, RefreshCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  activeCustomerDisplay,
  browserCustomerDisplayPosition,
  browserSecondaryScreens,
  customerDisplayPickerViewState,
  customerDisplayPosition,
  customerDisplayResolution,
  electronSecondaryDisplays,
  type BrowserCustomerDisplayInfo,
  type CustomerDisplayPickerMode
} from "./customer-display-picker-utils";

export type { CustomerDisplayPickerMode } from "./customer-display-picker-utils";

function SingleSecondaryScreenCard({ isActive, meta }: { isActive: boolean; meta: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary"
      >
        <Monitor />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-base font-black">{t("pos.customerDisplaySecondary")}</p>
          <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary">
            {t("pos.customerDisplayReady")}
          </Badge>
          {isActive ? (
            <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary">
              {t("pos.customerDisplayActive")}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{t("pos.customerDisplaySecondaryDescription")}</p>
        <p className="text-xs font-semibold text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

export function CustomerDisplayPickerDialog({
  canCloseCustomerDisplay,
  displayInfo,
  browserDisplayInfo,
  error,
  loading,
  mode,
  open,
  opening,
  selectedDisplayId,
  selectedBrowserScreenKey,
  onCloseCustomerDisplay,
  onOpenBrowserDisplay,
  onOpenSelectedBrowserDisplay,
  onOpenChange,
  onOpenSelectedDisplay,
  onRefresh,
  onSelectedBrowserScreenChange,
  onSelectedDisplayChange
}: {
  canCloseCustomerDisplay: boolean;
  displayInfo: ElectronDisplayInfo | null;
  browserDisplayInfo: BrowserCustomerDisplayInfo | null;
  error: string | null;
  loading: boolean;
  mode: CustomerDisplayPickerMode;
  open: boolean;
  opening: boolean;
  selectedDisplayId: number | null;
  selectedBrowserScreenKey: string | null;
  onCloseCustomerDisplay: () => void;
  onOpenBrowserDisplay: () => void;
  onOpenSelectedBrowserDisplay: () => void;
  onOpenChange: (open: boolean) => void;
  onOpenSelectedDisplay: () => void;
  onRefresh: () => void;
  onSelectedBrowserScreenChange: (screenKey: string) => void;
  onSelectedDisplayChange: (displayId: number) => void;
}) {
  const { t } = useTranslation();
  const isElectronMode = mode === "electron";
  const closeDisabled = opening || !canCloseCustomerDisplay;

  const activeDisplay = activeCustomerDisplay(displayInfo);
  const electronCandidates = electronSecondaryDisplays(displayInfo);
  const browserCandidates = browserSecondaryScreens(browserDisplayInfo);
  const totalCount = isElectronMode ? (displayInfo?.displays.length ?? 0) : (browserDisplayInfo?.screens.length ?? 0);
  const secondaryCount = isElectronMode ? electronCandidates.length : browserCandidates.length;
  const viewState = customerDisplayPickerViewState({ loading, mode, secondaryCount, totalCount });

  const singleElectronMeta = electronCandidates[0]
    ? [
        customerDisplayResolution(electronCandidates[0]),
        customerDisplayPosition(electronCandidates[0]),
        t("pos.customerDisplayScale", { scale: electronCandidates[0].scaleFactor })
      ].join(" - ")
    : "";
  const singleBrowserMeta = browserCandidates[0]
    ? [
        customerDisplayResolution(browserCandidates[0]),
        browserCustomerDisplayPosition(browserCandidates[0]),
        t("pos.customerDisplayScale", { scale: browserCandidates[0].devicePixelRatio })
      ].join(" - ")
    : "";

  const primaryButtonDisabled =
    loading || opening || (isElectronMode ? selectedDisplayId === null : selectedBrowserScreenKey === null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 duration-200 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base font-black">
            <Monitor />
            {t("pos.customerDisplayPickerTitle")}
          </DialogTitle>
          <DialogDescription>{t("pos.customerDisplayPickerDescription")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t("pos.customerDisplayLoadFailed")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {viewState === "unsupported" ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <ExternalLink />
                <span>{t("pos.customerDisplayBrowserModeDescription")}</span>
              </div>
            ) : viewState === "loading" ? (
              <div className="flex min-h-52 items-center justify-center rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Spinner data-icon="inline-start" />
                  {t("pos.customerDisplayLoadingScreens")}
                </div>
              </div>
            ) : viewState === "no-screens" ? (
              <Alert>
                <AlertTitle>{t("pos.customerDisplayNoScreens")}</AlertTitle>
                <AlertDescription>{t("pos.customerDisplayNoScreensDescription")}</AlertDescription>
              </Alert>
            ) : viewState === "no-secondary" ? (
              <Alert>
                <AlertTitle>{t("pos.customerDisplayNoSecondary")}</AlertTitle>
                <AlertDescription>{t("pos.customerDisplayNoSecondaryDescription")}</AlertDescription>
              </Alert>
            ) : viewState === "single-secondary" ? (
              <SingleSecondaryScreenCard
                isActive={isElectronMode && electronCandidates[0]?.id === activeDisplay?.id}
                meta={isElectronMode ? singleElectronMeta : singleBrowserMeta}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  <span>{t("pos.customerDisplayDetectedScreens", { count: secondaryCount })}</span>
                </div>

                {isElectronMode ? (
                  <RadioGroup
                    className="grid gap-2 sm:grid-cols-2"
                    value={selectedDisplayId === null ? "" : String(selectedDisplayId)}
                    onValueChange={(value) => onSelectedDisplayChange(Number(value))}
                  >
                    {electronCandidates.map((display, index) => {
                      const selected = selectedDisplayId === display.id;
                      const radioId = `customer-display-${display.id}`;
                      const isActive = display.id === activeDisplay?.id;

                      return (
                        <Field
                          key={display.id}
                          orientation="horizontal"
                          className={cn(
                            "min-h-24 cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected && "border-primary bg-primary/10 shadow-sm"
                          )}
                          tabIndex={0}
                          onClick={() => onSelectedDisplayChange(display.id)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            onSelectedDisplayChange(display.id);
                          }}
                        >
                          <RadioGroupItem id={radioId} className="mt-1" value={String(display.id)} />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-muted text-muted-foreground",
                              selected && "border-primary/30 bg-primary/15 text-primary"
                            )}
                          >
                            <Monitor />
                          </span>
                          <FieldLabel htmlFor={radioId} className="min-w-0 w-full flex-1 cursor-pointer">
                            <div className="flex min-w-0 flex-col gap-2">
                              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-base font-black">
                                    {t("pos.customerDisplayScreenNumber", { count: index + 1 })}
                                  </p>
                                  <p className="text-sm font-semibold text-muted-foreground">
                                    {t("pos.customerDisplaySecondaryDescription")}
                                  </p>
                                </div>
                                {isActive ? (
                                  <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary">
                                    {t("pos.customerDisplayActive")}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-xs font-semibold text-muted-foreground">
                                {customerDisplayResolution(display)}
                                {" - "}
                                {customerDisplayPosition(display)}
                                {" - "}
                                {t("pos.customerDisplayScale", { scale: display.scaleFactor })}
                              </p>
                            </div>
                          </FieldLabel>
                        </Field>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  <RadioGroup
                    className="grid gap-2 sm:grid-cols-2"
                    value={selectedBrowserScreenKey ?? ""}
                    onValueChange={onSelectedBrowserScreenChange}
                  >
                    {browserCandidates.map((screen, index) => {
                      const selected = selectedBrowserScreenKey === screen.key;
                      const radioId = `customer-browser-display-${index}`;

                      return (
                        <Field
                          key={screen.key}
                          orientation="horizontal"
                          className={cn(
                            "min-h-24 cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected && "border-primary bg-primary/10 shadow-sm"
                          )}
                          tabIndex={0}
                          onClick={() => onSelectedBrowserScreenChange(screen.key)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            onSelectedBrowserScreenChange(screen.key);
                          }}
                        >
                          <RadioGroupItem id={radioId} className="mt-1" value={screen.key} />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-muted text-muted-foreground",
                              selected && "border-primary/30 bg-primary/15 text-primary"
                            )}
                          >
                            <Monitor />
                          </span>
                          <FieldLabel htmlFor={radioId} className="min-w-0 w-full flex-1 cursor-pointer">
                            <div className="flex min-w-0 flex-col gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-base font-black">
                                  {screen.label || t("pos.customerDisplayScreenNumber", { count: index + 1 })}
                                </p>
                                <p className="text-sm font-semibold text-muted-foreground">
                                  {t("pos.customerDisplaySecondaryDescription")}
                                </p>
                              </div>
                              <p className="text-xs font-semibold text-muted-foreground">
                                {customerDisplayResolution(screen)}
                                {" - "}
                                {browserCustomerDisplayPosition(screen)}
                                {" - "}
                                {t("pos.customerDisplayScale", { scale: screen.devicePixelRatio })}
                              </p>
                            </div>
                          </FieldLabel>
                        </Field>
                      );
                    })}
                  </RadioGroup>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-card/95 px-4 py-3 sm:px-6 [&>button]:w-full sm:[&>button]:w-auto">
          {viewState === "unsupported" ? (
            <>
              <Button type="button" variant="outline" disabled={closeDisabled} onClick={onCloseCustomerDisplay}>
                <X data-icon="inline-start" />
                {t("pos.customerDisplayCloseScreen")}
              </Button>
              <Button type="button" disabled={opening} onClick={onOpenBrowserDisplay}>
                {opening ? <Spinner data-icon="inline-start" /> : <ExternalLink data-icon="inline-start" />}
                {t("pos.customerDisplayOpenBrowserTab")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={loading || opening} onClick={onRefresh}>
                <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
                {t("pos.customerDisplayRefreshScreens")}
              </Button>
              <Button type="button" variant="outline" disabled={closeDisabled} onClick={onCloseCustomerDisplay}>
                <X data-icon="inline-start" />
                {t("pos.customerDisplayCloseScreen")}
              </Button>
              <Button
                type="button"
                variant={viewState === "no-secondary" || viewState === "no-screens" ? "outline" : "default"}
                disabled={primaryButtonDisabled}
                onClick={isElectronMode ? onOpenSelectedDisplay : onOpenSelectedBrowserDisplay}
              >
                {opening ? <Spinner data-icon="inline-start" /> : <Monitor data-icon="inline-start" />}
                {viewState === "no-secondary" ? t("pos.customerDisplayOpenSameScreen") : t("pos.customerDisplayOpenOnScreen")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
