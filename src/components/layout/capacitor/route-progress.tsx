"use client";

import { useEffect, useState } from "react";
import { useLinkStatus } from "next/link";

// รอ 120ms ก่อนโชว์ — transition ที่เร็วกว่านั้นทำให้แถบกระพริบแทนที่จะสื่อความ
const PROGRESS_DELAY_MS = 120;

export function NativeRouteProgress() {
  const { pending } = useLinkStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), PROGRESS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-transparent"
    >
      <div className="native-route-progress-bar h-full w-1/3 bg-primary" />
    </div>
  );
}
