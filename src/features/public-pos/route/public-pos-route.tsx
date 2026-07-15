"use client";

import { useSearchParams } from "next/navigation";
import { WINDOW_OPEN_FONT_QUERY_PARAM } from "@/lib/window-open-fonts";
import { PublicPosClient } from "@/features/public-pos/order/public-pos-client";

export function PublicPosRoute() {
  const params = useSearchParams();

  return (
    <PublicPosClient
      token={params.get("t") ?? ""}
      queryLang={params.get("lang")}
      windowOpenFonts={params.get(WINDOW_OPEN_FONT_QUERY_PARAM) === "1"}
    />
  );
}
