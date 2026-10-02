"use client";

import { useEffect } from "react";
import type { PublicPosAccent } from "../types";

/** Mirror the menu's light theme and fonts onto body so Radix portals inherit
 *  the same appearance as main, even when the cashier app uses dark mode.
 */
export function usePublicPosThemeScope(
  fontClassName: string,
  accent: PublicPosAccent,
) {
  useEffect(() => {
    const { body } = document;
    const fontClasses = fontClassName.split(" ").filter(Boolean);

    body.setAttribute("data-yg-menu", "");
    // Portals share the customer menu's light theme without changing the POS theme.
    body.setAttribute("data-yg-theme", "light");
    body.classList.add(...fontClasses);

    return () => {
      body.removeAttribute("data-yg-menu");
      body.removeAttribute("data-yg-theme");
      body.classList.remove(...fontClasses);
    };
  }, [fontClassName]);

  // Keep the accent scope independent from font class cleanup.
  useEffect(() => {
    document.body.setAttribute("data-yg-accent", accent);
    return () => {
      document.body.removeAttribute("data-yg-accent");
    };
  }, [accent]);
}
