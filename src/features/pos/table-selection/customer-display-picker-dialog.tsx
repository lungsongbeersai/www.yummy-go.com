"use client";

import { ArrowRight, ExternalLink, Monitor, RefreshCcw, X } from "lucide-react";
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
  customerDisplayPosition,
  customerDisplayResolution,
  type BrowserCustomerDisplayInfo
} from "./customer-display-picker-utils";

export type CustomerDisplayPickerMode = "browser-fallback" | "browser-window-management" | "electron";

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
  const activeDisplay = activeCustomerDisplay(displayInfo);
  const displays = displayInfo?.displays ?? [];
  const browserScreens = browserDisplayInfo?.screens ?? [];
  const isBrowserFallbackMode = mode === "browser-fallback";
  const isBrowserWindowManagementMode = mode === "browser-window-management";
  const isElectronMode = mode === "electron";
  const closeDisabled = opening || !canCloseCustomerDisplay;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base font-black">
            <Monitor />
            {t("pos.customerDisplayPickerTitle")}
          </DialogTitle>
          <DialogDescription>{t("pos.customerDisplayPickerDescription")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-black">
              <span className="inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-muted-foreground">
                <Monitor />
                {t("pos.customerDisplayPrimary")}
              </span>
              <ArrowRight className="text-muted-foreground" />
              <span className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1.5 text-primary">
                <Monitor />
                {t("pos.customerDisplaySecondary")}
              </span>
            </div>

            {isBrowserFallbackMode ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <ExternalLink />
                <span>{t("pos.customerDisplayBrowserModeDescription")}</span>
              </div>
            ) : null}

            {isBrowserWindowManagementMode ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Monitor />
                <span>{t("pos.customerDisplayBrowserScreensDescription")}</span>
              </div>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t("pos.customerDisplayLoadFailed")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {isElectronMode && displayInfo ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
                <span>{t("pos.customerDisplayDetectedScreens", { count: displayInfo.count })}</span>
                {activeDisplay ? (
                  <Badge className="border-primary/20 bg-primary/10 text-primary">
                    {t("pos.customerDisplayActiveScreen", { screen: activeDisplay.id })}
                  </Badge>
                ) : null}
              </div>
            ) : null}

            {isBrowserWindowManagementMode && browserDisplayInfo ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
                <span>{t("pos.customerDisplayDetectedScreens", { count: browserDisplayInfo.count })}</span>
                <Badge className="border-border bg-muted text-muted-foreground">
                  {browserDisplayInfo.isExtended ? t("pos.customerDisplayExtended") : t("pos.customerDisplayNotExtended")}
                </Badge>
              </div>
            ) : null}

            {isElectronMode && displayInfo && !displayInfo.hasSecondary ? (
              <Alert>
                <AlertTitle>{t("pos.customerDisplayNoSecondary")}</AlertTitle>
                <AlertDescription>{t("pos.customerDisplayNoSecondaryDescription")}</AlertDescription>
              </Alert>
            ) : null}

            {isBrowserWindowManagementMode && browserDisplayInfo && (!browserDisplayInfo.hasSecondary || !browserDisplayInfo.isExtended) ? (
              <Alert>
                <AlertTitle>{t("pos.customerDisplayNoSecondary")}</AlertTitle>
                <AlertDescription>{t("pos.customerDisplayNoSecondaryDescription")}</AlertDescription>
              </Alert>
            ) : null}

            {isBrowserFallbackMode ? null : loading ? (
              <div className="flex min-h-52 items-center justify-center rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Spinner data-icon="inline-start" />
                  {t("pos.customerDisplayLoadingScreens")}
                </div>
              </div>
            ) : isElectronMode && displays.length ? (
              <RadioGroup
                className="grid gap-2 sm:grid-cols-2"
                value={selectedDisplayId === null ? "" : String(selectedDisplayId)}
                onValueChange={(value) => onSelectedDisplayChange(Number(value))}
              >
                {displays.map((display, index) => {
                  const selected = selectedDisplayId === display.id;
                  const isBackScreen = !display.isPrimary;
                  const radioId = `customer-display-${display.id}`;
                  const roleLabel = display.isPrimary
                    ? t("pos.customerDisplayPrimary")
                    : t("pos.customerDisplaySecondary");
                  const roleDescription = isBackScreen
                    ? t("pos.customerDisplaySecondaryDescription")
                    : t("pos.customerDisplayPrimaryDescription");

                  return (
                    <Field
                      key={display.id}
                      orientation="horizontal"
                      className={cn(
                        "min-h-24 cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isBackScreen && "border-primary/30 bg-primary/5",
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
                          isBackScreen && "border-primary/20 bg-primary/10 text-primary",
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
                              <p className="text-sm font-semibold text-muted-foreground">{roleDescription}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                              <Badge
                                className={cn(
                                  "shrink-0",
                                  display.isPrimary
                                    ? "border-border bg-muted text-muted-foreground"
                                    : "border-primary/20 bg-primary/10 text-primary"
                                )}
                              >
                                {roleLabel}
                              </Badge>
                              {isBackScreen ? (
                                <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary">
                                  {t("pos.customerDisplayRecommended")}
                                </Badge>
                              ) : null}
                              {display.id === activeDisplay?.id ? (
                                <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary">
                                  {t("pos.customerDisplayActive")}
                                </Badge>
                              ) : null}
                            </div>
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
            ) : isBrowserWindowManagementMode && browserScreens.length ? (
              <RadioGroup
                className="grid gap-2 sm:grid-cols-2"
                value={selectedBrowserScreenKey ?? ""}
                onValueChange={onSelectedBrowserScreenChange}
              >
                {browserScreens.map((screen, index) => {
                  const selected = selectedBrowserScreenKey === screen.key;
                  const radioId = `customer-browser-display-${index}`;
                  const isStaffScreen = screen.isPrimary || screen.isCurrent;
                  const isBackScreen = !isStaffScreen;
                  const roleLabel = isStaffScreen
                    ? t("pos.customerDisplayPrimary")
                    : t("pos.customerDisplaySecondary");
                  const roleDescription = isBackScreen
                    ? t("pos.customerDisplaySecondaryDescription")
                    : t("pos.customerDisplayPrimaryDescription");

                  return (
                    <Field
                      key={screen.key}
                      orientation="horizontal"
                      className={cn(
                        "min-h-24 cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isBackScreen && "border-primary/30 bg-primary/5",
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
                          isBackScreen && "border-primary/20 bg-primary/10 text-primary",
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
                                {screen.label || t("pos.customerDisplayScreenNumber", { count: index + 1 })}
                              </p>
                              <p className="text-sm font-semibold text-muted-foreground">{roleDescription}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                              <Badge
                                className={cn(
                                  "shrink-0",
                                  isStaffScreen
                                    ? "border-border bg-muted text-muted-foreground"
                                    : "border-primary/20 bg-primary/10 text-primary"
                                )}
                              >
                                {roleLabel}
                              </Badge>
                              {isBackScreen ? (
                                <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary">
                                  {t("pos.customerDisplayRecommended")}
                                </Badge>
                              ) : null}
                              {screen.isCurrent ? (
                                <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary">
                                  {t("pos.customerDisplayCurrent")}
                                </Badge>
                              ) : null}
                            </div>
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
            ) : (
              <Alert>
                <AlertTitle>{t("pos.customerDisplayNoScreens")}</AlertTitle>
                <AlertDescription>{t("pos.customerDisplayNoScreensDescription")}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-card/95 px-4 py-3 sm:px-6 [&>button]:w-full sm:[&>button]:w-auto">
          {isBrowserFallbackMode ? (
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
          ) : isBrowserWindowManagementMode ? (
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
                disabled={loading || opening || selectedBrowserScreenKey === null}
                onClick={onOpenSelectedBrowserDisplay}
              >
                {opening ? <Spinner data-icon="inline-start" /> : <Monitor data-icon="inline-start" />}
                {t("pos.customerDisplayOpenOnScreen")}
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
                disabled={loading || opening || selectedDisplayId === null}
                onClick={onOpenSelectedDisplay}
              >
                {opening ? <Spinner data-icon="inline-start" /> : <Monitor data-icon="inline-start" />}
                {t("pos.customerDisplayOpenOnScreen")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
