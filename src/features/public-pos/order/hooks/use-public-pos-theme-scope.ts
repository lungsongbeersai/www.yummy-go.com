"use client";

import { useEffect } from "react";
import type { PublicPosTheme } from "../public-pos-theme";
import type { PublicPosAccent } from "../types";

/** Mirror the menu's own theme (light/dark, independent of the cashier app's theme) and fonts onto
 *  body so Radix portals inherit the same appearance as main.
 */
export function usePublicPosThemeScope(
  fontClassName: string,
  accent: PublicPosAccent,
  theme: PublicPosTheme,
) {
  useEffect(() => {
    const { body } = document;
    const fontClasses = fontClassName.split(" ").filter(Boolean);

    body.setAttribute("data-yg-menu", "");
    body.classList.add(...fontClasses);

    return () => {
      body.removeAttribute("data-yg-menu");
      body.classList.remove(...fontClasses);
    };
  }, [fontClassName]);

  // Portals share the customer menu's theme without changing the POS theme.
  useEffect(() => {
    document.body.setAttribute("data-yg-theme", theme);
    return () => {
      document.body.removeAttribute("data-yg-theme");
    };
  }, [theme]);

  // Keep the accent scope independent from font class cleanup.
  useEffect(() => {
    document.body.setAttribute("data-yg-accent", accent);
    return () => {
      document.body.removeAttribute("data-yg-accent");
    };
  }, [accent]);
}
