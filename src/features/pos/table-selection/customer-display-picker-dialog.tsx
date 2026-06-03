"use client";

import { Monitor, RefreshCcw, X } from "lucide-react";
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
  customerDisplayPosition,
  customerDisplayResolution
} from "./customer-display-picker-utils";

export function CustomerDisplayPickerDialog({
  displayInfo,
  error,
  loading,
  open,
  opening,
  selectedDisplayId,
  onCloseCustomerDisplay,
  onOpenChange,
  onOpenSelectedDisplay,
  onRefresh,
  onSelectedDisplayChange
}: {
  displayInfo: ElectronDisplayInfo | null;
  error: string | null;
  loading: boolean;
  open: boolean;
  opening: boolean;
  selectedDisplayId: number | null;
  onCloseCustomerDisplay: () => void;
  onOpenChange: (open: boolean) => void;
  onOpenSelectedDisplay: () => void;
  onRefresh: () => void;
  onSelectedDisplayChange: (displayId: number) => void;
}) {
  const { t } = useTranslation();
  const activeDisplay = activeCustomerDisplay(displayInfo);
  const displays = displayInfo?.displays ?? [];

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
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t("pos.customerDisplayLoadFailed")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {displayInfo && !displayInfo.hasSecondary ? (
              <Alert>
                <AlertTitle>{t("pos.customerDisplayNoSecondary")}</AlertTitle>
                <AlertDescription>{t("pos.customerDisplayNoSecondaryDescription")}</AlertDescription>
              </Alert>
            ) : null}

            {loading ? (
              <div className="flex min-h-52 items-center justify-center rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Spinner data-icon="inline-start" />
                  {t("pos.customerDisplayLoadingScreens")}
                </div>
              </div>
            ) : displays.length ? (
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
                        "items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors",
                        selected && "border-primary bg-primary/5"
                      )}
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
            ) : (
              <Alert>
                <AlertTitle>{t("pos.customerDisplayNoScreens")}</AlertTitle>
                <AlertDescription>{t("pos.customerDisplayNoScreensDescription")}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-card/95 px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" disabled={loading || opening} onClick={onRefresh}>
            <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
            {t("pos.customerDisplayRefreshScreens")}
          </Button>
          {activeDisplay ? (
            <Button type="button" variant="outline" disabled={opening} onClick={onCloseCustomerDisplay}>
              <X data-icon="inline-start" />
              {t("pos.customerDisplayCloseScreen")}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={loading || opening || selectedDisplayId === null}
            onClick={onOpenSelectedDisplay}
          >
            {opening ? <Spinner data-icon="inline-start" /> : <Monitor data-icon="inline-start" />}
            {t("pos.customerDisplayOpenOnScreen")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
