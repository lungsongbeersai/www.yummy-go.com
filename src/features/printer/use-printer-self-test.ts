"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { PrinterSelfTestInput } from "@/services/printer";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";

export function usePrinterSelfTest() {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const printing = usePrinterStore((state) => state.printing);
  const pendingSelfTest = usePrinterStore((state) => state.pendingSelfTest);
  const restoreSelfTest = usePrinterStore((state) => state.restoreSelfTest);
  const selfTestPrinter = usePrinterStore((state) => state.selfTest);
  const completeSelfTestPrinter = usePrinterStore((state) => state.completeSelfTest);

  useEffect(() => {
    restoreSelfTest();
  }, [restoreSelfTest]);

  useEffect(() => {
    if (!pendingSelfTest) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [pendingSelfTest]);

  async function runSelfTest(target: PrinterSelfTestInput) {
    try {
      await selfTestPrinter(target);
      showToast({
        title: t("printer.selfTestCommandSent"),
        description: t("printer.selfTestCommandSentHint"),
        tone: "info",
      });
    } catch (error) {
      showToast({
        title: t("printer.selfTestFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }

  async function completeSelfTest() {
    try {
      await completeSelfTestPrinter();
    } catch (error) {
      showToast({
        title: t("printer.selfTestResumeFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }

  return { printing, pendingSelfTest, runSelfTest, completeSelfTest };
}
