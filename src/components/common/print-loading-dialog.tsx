"use client";

import { useTranslation } from "react-i18next";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";

export function PrintLoadingDialog({ open }: { open: boolean }) {
  const { t } = useTranslation();

  return (
    <BlockingLoadingDialog
      open={open}
      title={t("common.printing")}
      description={t("common.printingDescription")}
    />
  );
}
