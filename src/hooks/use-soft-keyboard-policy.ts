"use client";

import { useEffect, useState } from "react";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";

export function useSuppressSoftKeyboard() {
  const [suppress, setSuppress] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const sync = () => setSuppress(isCapacitorNativeApp() || mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);

    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return suppress;
}
