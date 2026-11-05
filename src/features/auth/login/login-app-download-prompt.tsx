"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { useAuthStore } from "@/stores/auth-store";
import appVersionConfig from "../../../../public/app-version.json";
import { AppleIcon, GooglePlayIcon } from "./login-provider-icons";
import { detectMobileAppDownloadPlatform } from "./mobile-app-download";

const subscribe = () => () => {};

function getClientPlatform() {
  return detectMobileAppDownloadPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    isNativeApp: isCapacitorNativeApp(),
  });
}

export function LoginAppDownloadPrompt() {
  const { t } = useTranslation();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [dismissed, setDismissed] = useState(false);
  // Device detection stays client-side so the initial server/client markup agrees.
  const platform = useSyncExternalStore(subscribe, getClientPlatform, () => null);

  if (!platform) return null;

  const store = platform === "ios" ? appVersionConfig.ios : appVersionConfig.android;
  const StoreIcon = platform === "ios" ? AppleIcon : GooglePlayIcon;

  return (
    <Dialog
      open={store.enabled && hydrated && !isLoggedIn && !dismissed}
      onOpenChange={(open) => { if (!open) setDismissed(true); }}
    >
      <DialogContent
        showCloseButton={false}
        className="login-light-zone max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-2xl bg-card p-6 text-card-foreground sm:max-w-sm"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("login-title")?.focus({ preventScroll: true });
        }}
      >
        <span className="grid size-16 place-items-center overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-foreground/10">
          <Image src="/brand/icon-mark.png" alt="" width={64} height={64} />
        </span>

        <DialogHeader className="gap-2">
          <DialogTitle className="font-lao text-xl font-bold leading-8">
            {t("auth.mobileAppPrompt.title")}
          </DialogTitle>
          <DialogDescription className="font-lao text-sm leading-6">
            {t("auth.mobileAppPrompt.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button asChild className="h-14 w-full justify-start gap-3 rounded-xl px-4">
            <a
              href={store.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t(platform === "ios" ? "auth.downloadFromAppStore" : "auth.downloadFromGooglePlay")}
              onClick={() => setDismissed(true)}
            >
              <StoreIcon className="size-7" />
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="font-lao text-xs font-normal">
                  {t(platform === "ios" ? "auth.downloadOn" : "auth.getItOn")}
                </span>
                <span className="text-base font-semibold">
                  {platform === "ios" ? "App Store" : "Google Play"}
                </span>
              </span>
            </a>
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="h-11 w-full whitespace-normal rounded-xl font-lao text-sm">
              {t("auth.mobileAppPrompt.continueInBrowser")}
            </Button>
          </DialogClose>
        </div>

        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-11 rounded-xl"
            aria-label={t("actions.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
