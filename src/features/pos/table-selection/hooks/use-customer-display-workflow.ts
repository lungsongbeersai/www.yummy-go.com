"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  publishCustomerDisplayPayload,
  type CustomerDisplayPayload,
} from "@/features/customer-display/shared/customer-display-sync";
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
    mode === "electron"
      ? Boolean(activeCustomerDisplay(displayInfo))
      : browserActive;

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
    if (!currentPayload) return;

    try {
      publishCustomerDisplayPayload(currentPayload, {
        browser: true,
        electron: Boolean(window.electronAPI),
      });
    } catch {
      // Realtime sync should never interrupt POS cart workflows.
    }
  }, [currentPayload]);

  function openBrowserDisplay(
    payload: CustomerDisplayPayload,
    targetScreen?: BrowserCustomerDisplayScreen | null,
  ) {
    const openedWindow = window.open(
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

    if (!window.electronAPI) {
      await refreshBrowserDisplays(false);
      return;
    }

    setMode("electron");
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
    if (!currentPayload || selectedDisplayId === null || !window.electronAPI)
      return;

    setOpening(true);
    setError(null);
    try {
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
