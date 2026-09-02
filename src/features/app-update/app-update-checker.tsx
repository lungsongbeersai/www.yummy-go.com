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
    // Try native store schemes first (market:// , itms-apps://). On a device
    // with no handler for them — no Play Store, an old iOS, or an old APK
    // without AppLauncher — they resolve to nothing. Always finish on the
    // https store URL: every WebView can open it and the OS hands off to the
    // store app from there. Falling back to the native scheme again (the old
    // bug) left those devices unable to update.
    const candidates = [
      config.nativeStoreUrl,
      config.storeUrl,
    ].filter((url): url is string => typeof url === "string" && url.length > 0);

    if (Capacitor.isPluginAvailable("AppLauncher")) {
      for (const url of candidates) {
        try {
          const result = await AppLauncher.openUrl({ url });
          if (result.completed) return;
        } catch {
          // try the next candidate
        }
      }
    }

    const httpsUrl =
      config.storeUrl && /^https:\/\//i.test(config.storeUrl)
        ? config.storeUrl
        : (config.nativeStoreUrl ?? config.storeUrl);
    window.location.assign(httpsUrl);
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
