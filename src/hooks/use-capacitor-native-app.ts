"use client";

import { useEffect, useState } from "react";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";

export function useIsCapacitorNativeApp() {
  const [nativeApp, setNativeApp] = useState(false);

  useEffect(() => {
    setNativeApp(isCapacitorNativeApp());
  }, []);

  return nativeApp;
}
