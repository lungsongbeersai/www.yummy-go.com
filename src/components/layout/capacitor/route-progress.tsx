"use client";

import { useLinkStatus } from "next/link";

export function NativeRouteProgress() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <div
      aria-hidden="true"
      className="native-route-progress absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-transparent"
    >
      <div className="native-route-progress-bar h-full w-1/3 bg-primary" />
    </div>
  );
}
