"use client";

import { useEffect, useState } from "react";

const DEFAULT_LOADING_MS = 180;

export function useDropdownButtonLoading({
  delay = DEFAULT_LOADING_MS,
  loading = false,
  loadingKey,
  open
}: {
  delay?: number;
  loading?: boolean;
  loadingKey?: number | string;
  open: boolean;
}) {
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!open) {
      setOpening(false);
      return;
    }

    setOpening(true);
    const timer = window.setTimeout(() => setOpening(false), delay);

    return () => window.clearTimeout(timer);
  }, [delay, loadingKey, open]);

  return open && (loading || opening);
}
