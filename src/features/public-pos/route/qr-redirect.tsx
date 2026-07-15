"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WINDOW_OPEN_FONT_QUERY_PARAM } from "@/lib/window-open-fonts";

export function QRRedirect({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(publicPosRedirectUrl(token, window.location.search));
  }, [router, token]);

  return null;
}

export function publicPosRedirectUrl(token: string, sourceSearch: string) {
  const destinationParams = new URLSearchParams({ t: token });
  const sourceParams = new URLSearchParams(sourceSearch);
  if (sourceParams.get(WINDOW_OPEN_FONT_QUERY_PARAM) === "1") {
    destinationParams.set(WINDOW_OPEN_FONT_QUERY_PARAM, "1");
  }
  return `/pos?${destinationParams.toString()}`;
}
