"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PrinterSelfTestCommandProfile, PrinterSelfTestInput } from "@/services/printer";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";

export function usePrinterSelfTest() {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const printing = usePrinterStore((state) => state.printing);
  const pendingSelfTest = usePrinterStore((state) => state.pendingSelfTest);
  const selfTestPhase = usePrinterStore((state) => state.selfTestPhase);
  const selfTestError = usePrinterStore((state) => state.error);
  const checkSelfTestPrinter = usePrinterStore((state) => state.checkSelfTest);
  const restoreSelfTest = usePrinterStore((state) => state.restoreSelfTest);
  const selfTestPrinter = usePrinterStore((state) => state.selfTest);
  const completeSelfTestPrinter = usePrinterStore((state) => state.completeSelfTest);
  const [selfTestSelection, setSelfTestSelection] = useState<PrinterSelfTestInput | null>(null);
  const [selfTestProfile, setSelfTestProfile] = useState<PrinterSelfTestCommandProfile>("epson");

  useEffect(() => {
    restoreSelfTest();
  }, [restoreSelfTest]);

  useEffect(() => {
    if (pendingSelfTest?.self_test_id && selfTestPhase === "restored" && !printing) {
      void checkSelfTestPrinter().catch(() => undefined);
    }
  }, [pendingSelfTest, selfTestPhase, printing, checkSelfTestPrinter]);

  useEffect(() => {
    if (!pendingSelfTest) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [pendingSelfTest]);

  async function runSelfTest(target: PrinterSelfTestInput) {
    if (printing || pendingSelfTest || selfTestSelection) return;
    setSelfTestProfile("epson");
    setSelfTestSelection(target);
  }

  async function confirmSelfTest() {
    if (!selfTestSelection || printing || pendingSelfTest) return;
    const target = { ...selfTestSelection, command_profile: selfTestProfile };
    setSelfTestSelection(null);
    try {
      await selfTestPrinter(target);
    } catch (error) {
      showToast({
        title: t(usePrinterStore.getState().pendingSelfTest ? "printer.selfTestStatusFailed" : "printer.selfTestFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }

  async function checkSelfTest() {
    try {
      await checkSelfTestPrinter();
    } catch (error) {
      showToast({ title: t("printer.selfTestStatusFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
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

  return {
    printing, pendingSelfTest, runSelfTest, completeSelfTest,
    selfTestSelection, selfTestProfile, setSelfTestProfile, confirmSelfTest,
    cancelSelfTest: () => setSelfTestSelection(null),
    selfTestPhase, selfTestError, checkSelfTest,
  };
}
