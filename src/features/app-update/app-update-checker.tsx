"use client";

import { useEffect, useState } from "react";
import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor } from "@capacitor/core";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  hasAppUpdate,
  type AppPlatformVersionConfig,
  type InstalledAppVersion,
  type MobileAppPlatform,
} from "@/lib/app-version";
import {
  getInstalledMobileAppVersion,
  getMobileAppPlatform,
} from "@/lib/installed-app-version";
import { useAppVersionStore } from "@/stores/app-version-store";

interface UpdatePrompt {
  config: AppPlatformVersionConfig;
  installed: InstalledAppVersion;
  platform: MobileAppPlatform;
}

export function AppUpdateChecker() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<UpdatePrompt | null>(null);
  const loadConfig = useAppVersionStore((state) => state.loadConfig);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const platform = getMobileAppPlatform();
    if (!platform) return;
    const activePlatform: MobileAppPlatform = platform;

    const controller = new AbortController();

    async function checkVersion() {
      try {
        const [config, installed] = await Promise.all([
          loadConfig(controller.signal),
          getInstalledMobileAppVersion(activePlatform),
        ]);
        const platformConfig = config?.[activePlatform];

        if (platformConfig && installed && hasAppUpdate(platformConfig, installed)) {
          setPrompt({ config: platformConfig, installed, platform: activePlatform });
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPrompt(null);
        }
      }
    }

    void checkVersion();
    return () => controller.abort();
  }, [loadConfig]);

  if (!prompt) return null;

  const { config, installed, platform } = prompt;
  const storeName = platform === "android" ? "Google Play" : "App Store";

  async function openStore() {
    if (Capacitor.isPluginAvailable("AppLauncher")) {
      try {
        const result = await AppLauncher.openUrl({
          url: config.nativeStoreUrl ?? config.storeUrl,
        });
        if (result.completed) return;
      } catch {
        // APK เก่ายังไม่มี AppLauncher; Capacitor จะส่ง market URL ไปให้ Android จัดการต่อ
      }
    }

    window.location.assign(config.nativeStoreUrl ?? config.storeUrl);
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !config.forceUpdate) setPrompt(null);
      }}
    >
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <Download aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("appUpdate.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {config.forceUpdate
              ? t("appUpdate.requiredDescription", { storeName })
              : t("appUpdate.description", { storeName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg bg-muted/60 p-3 text-sm">
          <dt className="text-muted-foreground">{t("appUpdate.currentVersion")}</dt>
          <dd className="font-mono font-semibold">{installed.version}</dd>
          <dt className="text-muted-foreground">{t("appUpdate.latestVersion")}</dt>
          <dd className="font-mono font-semibold text-primary">{config.latestVersion}</dd>
        </dl>

        <AlertDialogFooter>
          {!config.forceUpdate ? (
            <AlertDialogCancel>{t("appUpdate.later")}</AlertDialogCancel>
          ) : null}
          <AlertDialogAction onClick={() => void openStore()}>
            {t("appUpdate.updateNow")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
