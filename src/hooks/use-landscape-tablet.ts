"use client";

import { useMediaQuery } from "./use-media-query";

export const LANDSCAPE_TABLET_MEDIA_QUERY =
  "(min-width: 768px) and (orientation: landscape)";

export function useLandscapeTablet() {
  return useMediaQuery(LANDSCAPE_TABLET_MEDIA_QUERY);
}
