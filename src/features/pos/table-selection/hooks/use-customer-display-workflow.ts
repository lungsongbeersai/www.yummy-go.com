"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  publishCustomerDisplayPayload,
  type CustomerDisplayPayload,
} from "@/features/customer-display/shared/customer-display-sync";
import { isCapacitorAndroidApp, openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import { SwanCustomerDisplay, swanStatusToDisplayInfo } from "@/lib/swan-customer-display-bridge";
import { useToastStore } from "@/stores/toast-store";
import type { CustomerDisplayPickerMode } from "../customer-display-picker-dialog";
import {
  BROWSER_CUSTOMER_DISPLAY_TARGET_STORAGE_KEY,
  CUSTOMER_DISPLAY_TARGET_STORAGE_KEY,
  activeCustomerDisplay,
  browserCustomerDisplayWindowFeatures,
  browserCustomerDisplayWindowIsActive,
  browserDisplayIsConnected,
  closeBrowserCustomerDisplayWindow,
  customerDisplayIdFromStorage,
  defaultBrowserCustomerDisplayKey,
  defaultCustomerDisplayId,
  displayIsConnected,
  normalizeBrowserCustomerDisplayInfo,
  type BrowserCustomerDisplayInfo,
  type BrowserCustomerDisplayScreen,
} from "../customer-display-picker-utils";

export function useCustomerDisplayWorkflow(
  currentPayload: CustomerDisplayPayload | null,
) {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const [open, setOpen] = useState(false);
  const [mode, setMode] =
    useState<CustomerDisplayPickerMode>("browser-fallback");
  const [displayInfo, setDisplayInfo] = useState<ElectronDisplayInfo | null>(
    null,
  );
  const [browserDisplayInfo, setBrowserDisplayInfo] =
    useState<BrowserCustomerDisplayInfo | null>(null);
  const [browserScreenDetails, setBrowserScreenDetails] =
    useState<ScreenDetails | null>(null);
  const browserWindowRef = useRef<Window | null>(null);
  const nativeOpenedRef = useRef(false);
  const [browserActive, setBrowserActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(
    null,
  );
  const [selectedBrowserScreenKey, setSelectedBrowserScreenKey] = useState<
    string | null
  >(null);

  const canCloseCustomerDisplay =
    mode === "electron" || mode === "native-android"
      ? Boolean(activeCustomerDisplay(displayInfo))
      : browserActive;

  useEffect(() => () => {
    if (nativeOpenedRef.current) {
      void SwanCustomerDisplay.close().catch(() => {
        // Leaving POS must not leave a previous restaurant's totals on the rear screen.
      });
    }
  }, []);

  const syncBrowserActive = useCallback(() => {
    const active = browserCustomerDisplayWindowIsActive(
      browserWindowRef.current,
    );

    if (!active) {
      browserWindowRef.current = null;
    }
    setBrowserActive(active);

    return active;
  }, []);

  const applyBrowserDisplayInfo = useCallback(
    (details: ScreenDetails, preferCurrent = true) => {
      const info = normalizeBrowserCustomerDisplayInfo(
        {
          currentScreen: details.currentScreen,
          screens: details.screens,
        },
        Boolean(window.screen.isExtended),
      );

      setBrowserDisplayInfo(info);
      setSelectedBrowserScreenKey((current) => {
        const stored = window.localStorage.getItem(
          BROWSER_CUSTOMER_DISPLAY_TARGET_STORAGE_KEY,
        );
        const preferred =
          preferCurrent && browserDisplayIsConnected(info, current)
            ? current
            : stored;
        return defaultBrowserCustomerDisplayKey(info, preferred);
      });

      return info;
    },
    [],
  );

  useEffect(() => {
    if (
      !open ||
      mode !== "browser-window-management" ||
      !browserScreenDetails
    )
      return;

    const handleScreensChange = () => {
      applyBrowserDisplayInfo(browserScreenDetails, true);
    };

    browserScreenDetails.addEventListener("screenschange", handleScreensChange);
    return () => {
      browserScreenDetails.removeEventListener(
        "screenschange",
        handleScreensChange,
      );
    };
  }, [applyBrowserDisplayInfo, browserScreenDetails, mode, open]);

  useEffect(() => {
    if (!open || !browserActive) return;

    const intervalId = window.setInterval(() => {
      syncBrowserActive();
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [browserActive, open, syncBrowserActive]);

  useEffect(() => {
    if (!currentPayload) {
      if (mode === "native-android" && nativeOpenedRef.current) {
        nativeOpenedRef.current = false;
        void SwanCustomerDisplay.close()
          .then((status) => setDisplayInfo(swanStatusToDisplayInfo(status)))
          .catch(() => {
            // No cart data may remain visible when the selected sale is cleared.
          });
      }
      return;
    }

    if (mode === "native-android") {
      if (nativeOpenedRef.current) {
        void SwanCustomerDisplay.update({ payload: currentPayload }).catch(() => {
          // A detached HDMI display must not interrupt cashier cart updates.
        });
      }
      return;
    }

    try {
      publishCustomerDisplayPayload(currentPayload, {
        browser: true,
        electron: Boolean(window.electronAPI),
      });
    } catch {
      // Realtime sync should never interrupt POS cart workflows.
    }
  }, [currentPayload, mode]);

  function openBrowserDisplay(
    payload: CustomerDisplayPayload,
    targetScreen?: BrowserCustomerDisplayScreen | null,
  ) {
    const openedWindow = openWindowOutsideNativeApp(
      "/customer-display",
      "yummy-go-customer-display",
      browserCustomerDisplayWindowFeatures(targetScreen),
    );

    if (!openedWindow) {
      throw new Error(t("pos.customerDisplayPopupBlocked"));
    }

    openedWindow.focus();
    publishCustomerDisplayPayload(payload, {
      browser: true,
      electron: false,
      repeatBrowserMessage: true,
    });

    return openedWindow;
  }

  async function refreshBrowserDisplays(preferCurrent = true) {
    if (!window.getScreenDetails) {
      setMode("browser-fallback");
      setBrowserDisplayInfo(null);
      setBrowserScreenDetails(null);
      setSelectedBrowserScreenKey(null);
      setLoading(false);
      return null;
    }

    setMode("browser-window-management");
    setLoading(true);
    setError(null);
    try {
      const details = await window.getScreenDetails();
      setBrowserScreenDetails(details);
      return applyBrowserDisplayInfo(details, preferCurrent);
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "";
      setMode("browser-fallback");
      setBrowserDisplayInfo(null);
      setBrowserScreenDetails(null);
      setSelectedBrowserScreenKey(null);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function refreshDisplays(preferCurrent = true) {
    if (!window.electronAPI) {
      if (isCapacitorAndroidApp()) {
        setMode("native-android");
        setLoading(true);
        setError(null);
        try {
          const status = await SwanCustomerDisplay.getStatus();
          if (status.supported) {
            const info = swanStatusToDisplayInfo(status);
            setMode("native-android");
            setDisplayInfo(info);
            setBrowserDisplayInfo(null);
            setBrowserScreenDetails(null);
            setSelectedBrowserScreenKey(null);
            setSelectedDisplayId(info.displays.find((display) => !display.isPrimary)?.id ?? null);
            nativeOpenedRef.current = Boolean(status.active);
            setError(null);
            setLoading(false);
            return info;
          }
        } catch {
          // Older APKs and non-Swan Android devices keep their existing browser path.
        }
      }
      return refreshBrowserDisplays(preferCurrent);
    }

    setMode("electron");
    setBrowserDisplayInfo(null);
    setBrowserScreenDetails(null);
    setSelectedBrowserScreenKey(null);
    setLoading(true);
    setError(null);
    try {
      const info = await window.electronAPI.getDisplays();
      setDisplayInfo(info);
      setSelectedDisplayId((current) => {
        const stored = customerDisplayIdFromStorage(
          window.localStorage.getItem(CUSTOMER_DISPLAY_TARGET_STORAGE_KEY),
        );
        const preferred =
          preferCurrent && displayIsConnected(info, current)
            ? current
            : stored;
        return defaultCustomerDisplayId(info, preferred);
      });
      return info;
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function openCustomerDisplayScreen() {
    if (!currentPayload) return;

    setError(null);
    setDisplayInfo(null);
    setBrowserDisplayInfo(null);
    setBrowserScreenDetails(null);
    setSelectedDisplayId(null);
    setSelectedBrowserScreenKey(null);
    syncBrowserActive();
    setOpen(true);

    await refreshDisplays(false);
  }

  function openBrowserDisplayFromDialog() {
    if (!currentPayload) return;

    setOpening(true);
    setError(null);
    try {
      const openedWindow = openBrowserDisplay(currentPayload);
      browserWindowRef.current = openedWindow;
      setBrowserActive(true);
      setOpen(false);
      showToast({ title: t("pos.displayOpened"), tone: "success" });
    } catch (displayError) {
      const message = displayError instanceof Error ? displayError.message : "";
      setError(message);
      showToast({
        title: t("pos.displayOpenFailed"),
        description: message,
        tone: "error",
      });
    } finally {
      setOpening(false);
    }
  }

  function openSelectedBrowserDisplay() {
    if (!currentPayload || !browserDisplayInfo || !selectedBrowserScreenKey)
      return;

    const targetScreen = browserDisplayInfo.screens.find(
      (screen) => screen.key === selectedBrowserScreenKey,
    );
    if (!targetScreen) return;

    setOpening(true);
    setError(null);
    try {
      window.localStorage.setItem(
        BROWSER_CUSTOMER_DISPLAY_TARGET_STORAGE_KEY,
        selectedBrowserScreenKey,
      );
      const openedWindow = openBrowserDisplay(currentPayload, targetScreen);
      browserWindowRef.current = openedWindow;
      setBrowserActive(true);
      setOpen(false);
      showToast({ title: t("pos.displayOpened"), tone: "success" });
    } catch (displayError) {
      const message = displayError instanceof Error ? displayError.message : "";
      setError(message);
      showToast({
        title: t("pos.displayOpenFailed"),
        description: message,
        tone: "error",
      });
    } finally {
      setOpening(false);
    }
  }

  async function openSelectedElectronDisplay() {
    if (!currentPayload || selectedDisplayId === null) return;

    setOpening(true);
    setError(null);
    try {
      if (mode === "native-android") {
        const status = await SwanCustomerDisplay.open({ displayId: selectedDisplayId, payload: currentPayload });
        nativeOpenedRef.current = Boolean(status.active);
        setDisplayInfo(swanStatusToDisplayInfo(status));
        setOpen(false);
        showToast({ title: t("pos.displayOpened"), tone: "success" });
        return;
      }
      if (!window.electronAPI) return;
      const result = await window.electronAPI.openDisplay(selectedDisplayId);
      const displayId = result.displayId ?? selectedDisplayId;
      window.localStorage.setItem(
        CUSTOMER_DISPLAY_TARGET_STORAGE_KEY,
        String(displayId),
      );
      setSelectedDisplayId(displayId);
      publishCustomerDisplayPayload(currentPayload, {
        browser: false,
        electron: true,
      });
      setDisplayInfo(await window.electronAPI.getDisplays());
      setOpen(false);
      showToast({ title: t("pos.displayOpened"), tone: "success" });
    } catch (displayError) {
      const message = displayError instanceof Error ? displayError.message : "";
      setError(message);
      showToast({
        title: t("pos.displayOpenFailed"),
        description: message,
        tone: "error",
      });
    } finally {
      setOpening(false);
    }
  }

  async function closeCustomerDisplayScreen() {
    setOpening(true);
    setError(null);

    if (mode === "native-android") {
      try {
        const status = await SwanCustomerDisplay.close();
        nativeOpenedRef.current = false;
        setDisplayInfo(swanStatusToDisplayInfo(status));
        showToast({ title: t("pos.displayClosed"), tone: "success" });
      } catch (displayError) {
        const message = displayError instanceof Error ? displayError.message : "";
        setError(message);
        showToast({ title: t("pos.displayCloseFailed"), description: message, tone: "error" });
      } finally {
        setOpening(false);
      }
      return;
    }

    if (browserCustomerDisplayWindowIsActive(browserWindowRef.current)) {
      try {
        closeBrowserCustomerDisplayWindow(browserWindowRef.current);
        browserWindowRef.current = null;
        setBrowserActive(false);
        showToast({ title: t("pos.displayClosed"), tone: "success" });
      } catch (displayError) {
        const message = displayError instanceof Error ? displayError.message : "";
        setError(message);
        showToast({
          title: t("pos.displayCloseFailed"),
          description: message,
          tone: "error",
        });
      } finally {
        setOpening(false);
      }
      return;
    }

    if (!window.electronAPI) {
      browserWindowRef.current = null;
      setBrowserActive(false);
      setOpening(false);
      return;
    }

    try {
      await window.electronAPI.closeDisplay();
      const info = await window.electronAPI.getDisplays();
      setDisplayInfo(info);
      setSelectedDisplayId((current) =>
        defaultCustomerDisplayId(
          info,
          displayIsConnected(info, current)
            ? current
            : customerDisplayIdFromStorage(
                window.localStorage.getItem(CUSTOMER_DISPLAY_TARGET_STORAGE_KEY),
              ),
        ),
      );
      showToast({ title: t("pos.displayClosed"), tone: "success" });
    } catch (displayError) {
      const message = displayError instanceof Error ? displayError.message : "";
      setError(message);
      showToast({
        title: t("pos.displayCloseFailed"),
        description: message,
        tone: "error",
      });
    } finally {
      setOpening(false);
    }
  }

  return {
    browserDisplayInfo,
    canCloseCustomerDisplay,
    closeCustomerDisplayScreen,
    displayInfo,
    error,
    loading,
    mode,
    open,
    openBrowserDisplayFromDialog,
    opening,
    openCustomerDisplayScreen,
    openSelectedBrowserDisplay,
    openSelectedElectronDisplay,
    refreshDisplays,
    selectedBrowserScreenKey,
    selectedDisplayId,
    setOpen,
    setSelectedBrowserScreenKey,
    setSelectedDisplayId,
  };
}

export type CustomerDisplayWorkflow = ReturnType<
  typeof useCustomerDisplayWorkflow
>;
