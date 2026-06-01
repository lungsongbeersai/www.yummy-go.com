"use client";

import { useEffect, useState } from "react";

export function useHasTableSidePanel() {
  const [hasSidePanel, setHasSidePanel] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const update = () => setHasSidePanel(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return hasSidePanel;
}
