"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface PublicLoadFeedbackProps {
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PublicLoadFeedback({ loading, error, onRetry }: PublicLoadFeedbackProps) {
  const { t } = useTranslation();
  if (loading) return <LoadingMessage />;
  if (!error) return null;
  return (
    <Alert className="rounded-lg border-yg-line bg-yg-panel text-yg-ink">
      <AlertCircle aria-hidden="true" />
      <AlertTitle className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
        <span>{t("pos.publicLoadFailed")}</span>
        {onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>{t("actions.tryAgain")}</Button> : null}
      </AlertTitle>
    </Alert>
  );
}

function LoadingMessage() {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);
  return <p role="status" className="min-h-5 text-xs leading-5 text-yg-muted">{t(slow ? "pos.publicLoadingSlow" : "common.loading")}</p>;
}
