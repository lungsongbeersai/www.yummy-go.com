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
            <Alert>
              <AlertTitle>{t("pos.customerDisplayPickerHelpTitle")}</AlertTitle>
              <AlertDescription>{t("pos.customerDisplayPickerHelp")}</AlertDescription>
            </Alert>

            {isBrowserFallbackMode ? (
              <Alert>
                <AlertTitle>{t("pos.customerDisplayBrowserMode")}</AlertTitle>
                <AlertDescription>{t("pos.customerDisplayBrowserModeDescription")}</AlertDescription>
              </Alert>
            ) : null}

            {isBrowserWindowManagementMode ? (
              <Alert>
                <AlertTitle>{t("pos.customerDisplayBrowserScreens")}</AlertTitle>
                <AlertDescription>{t("pos.customerDisplayBrowserScreensDescription")}</AlertDescription>
              </Alert>
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
                value={selectedDisplayId === null ? "" : String(selectedDisplayId)}
                onValueChange={(value) => onSelectedDisplayChange(Number(value))}
              >
                {displays.map((display, index) => {
                  const selected = selectedDisplayId === display.id;
                  const radioId = `customer-display-${display.id}`;

                  return (
                    <Field
                      key={display.id}
                      orientation="horizontal"
                      className={cn(
                        "cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected && "border-primary bg-primary/5"
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
                      <FieldLabel htmlFor={radioId} className="min-w-0 flex-1 cursor-pointer">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-black">
                              {t("pos.customerDisplayScreenNumber", { count: index + 1 })}
                            </span>
                            <Badge className={display.isPrimary ? "border-border bg-muted text-muted-foreground" : undefined}>
                              {display.isPrimary ? t("pos.customerDisplayPrimary") : t("pos.customerDisplaySecondary")}
                            </Badge>
                            {!display.isPrimary ? (
                              <Badge className="border-primary/20 bg-primary/10 text-primary">
                                {t("pos.customerDisplayRecommended")}
                              </Badge>
                            ) : null}
                            {display.id === activeDisplay?.id ? (
                              <Badge className="border-primary/20 bg-primary/10 text-primary">
                                {t("pos.customerDisplayActive")}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="grid gap-1 text-xs font-semibold text-muted-foreground sm:grid-cols-3">
                            <span>{customerDisplayResolution(display)}</span>
                            <span>{customerDisplayPosition(display)}</span>
                            <span>{t("pos.customerDisplayScale", { scale: display.scaleFactor })}</span>
                          </div>
                        </div>
                      </FieldLabel>
                    </Field>
                  );
                })}
              </RadioGroup>
            ) : isBrowserWindowManagementMode && browserScreens.length ? (
              <RadioGroup
                value={selectedBrowserScreenKey ?? ""}
                onValueChange={onSelectedBrowserScreenChange}
              >
                {browserScreens.map((screen, index) => {
                  const selected = selectedBrowserScreenKey === screen.key;
                  const radioId = `customer-browser-display-${index}`;
                  const isStaffScreen = screen.isPrimary || screen.isCurrent;

                  return (
                    <Field
                      key={screen.key}
                      orientation="horizontal"
                      className={cn(
                        "cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected && "border-primary bg-primary/5"
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
                      <FieldLabel htmlFor={radioId} className="min-w-0 flex-1 cursor-pointer">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-black">
                              {screen.label || t("pos.customerDisplayScreenNumber", { count: index + 1 })}
                            </span>
                            <Badge className={isStaffScreen ? "border-border bg-muted text-muted-foreground" : undefined}>
                              {isStaffScreen ? t("pos.customerDisplayPrimary") : t("pos.customerDisplaySecondary")}
                            </Badge>
                            {!isStaffScreen ? (
                              <Badge className="border-primary/20 bg-primary/10 text-primary">
                                {t("pos.customerDisplayRecommended")}
                              </Badge>
                            ) : null}
                            <Badge className="border-border bg-muted text-muted-foreground">
                              {screen.isInternal ? t("pos.customerDisplayInternal") : t("pos.customerDisplayExternal")}
                            </Badge>
                            {screen.isCurrent ? (
                              <Badge className="border-primary/20 bg-primary/10 text-primary">
                                {t("pos.customerDisplayCurrent")}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="grid gap-1 text-xs font-semibold text-muted-foreground sm:grid-cols-3">
                            <span>{customerDisplayResolution(screen)}</span>
                            <span>{browserCustomerDisplayPosition(screen)}</span>
                            <span>{t("pos.customerDisplayScale", { scale: screen.devicePixelRatio })}</span>
                          </div>
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
