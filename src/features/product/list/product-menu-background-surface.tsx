import Image from "next/image";
import type { CSSProperties } from "react";
import { normalizeMenuBackground, type ProductMenuBackground } from "./product-menu-background";

export function menuBackgroundAttributes(background?: ProductMenuBackground) {
  const selected = normalizeMenuBackground(background);
  const style: CSSProperties & { "--menu-custom-background"?: string } = selected.mode === "color"
    ? { "--menu-custom-background": selected.color }
    : {};
  return { "data-menu-background-mode": selected.mode, style };
}

export function ProductMenuBackgroundLayer({ background }: { background?: ProductMenuBackground }) {
  const selected = normalizeMenuBackground(background);
  return selected.mode === "image" ? <div className="product-menu-custom-background" data-menu-custom-background aria-hidden="true">
    <Image src={selected.image} alt="" width={1600} height={2263} unoptimized loading="eager" />
    <div className="product-menu-custom-background-wash" />
  </div> : null;
}
