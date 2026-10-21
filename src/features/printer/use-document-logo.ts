"use client";

import { useEffect, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import type { Printer } from "@/services/printer";
import { useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { documentLogoDefault, type DocumentLogoRole } from "./document-logo";

export function useDocumentLogo(open: boolean, loginUuid: string | undefined, documentKey: string, documentRole?: DocumentLogoRole) {
  const loadPrinters = usePrinterStore((state) => state.loadPrintersForLocalAgent);
  const branchUuid = useAuthStore((state) => state.user?.branch_uuid);
  const [printers, setPrinters] = useState<Printer[] | null>(null);
  const [showLogo, setShowLogo] = useState<boolean | undefined>();

  useResetOnDeps([open, loginUuid, branchUuid, documentKey, documentRole], () => {
    setShowLogo(undefined);
    setPrinters(null);
  });

  useEffect(() => {
    if (!open || !loginUuid) return;
    let active = true;
    void loadPrinters({ login_uuid_fk: loginUuid })
      .then((items) => { if (active) setPrinters(items); })
      // An untouched checkbox leaves the backend's per-printer defaults in use.
      .catch(() => undefined);
    return () => { active = false; };
  }, [branchUuid, documentKey, documentRole, loadPrinters, loginUuid, open]);

  const checked = showLogo ?? documentLogoDefault(printers, documentRole);
  return {
    checked,
    previewShowLogo: checked !== false,
    previewShowInvoiceLogo: (showLogo ?? documentLogoDefault(printers, "invoice")) !== false,
    setShowLogo,
    showLogo,
  };
}
