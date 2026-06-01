"use client";

import { useSearchParams } from "next/navigation";
import { PublicPosClient } from "@/features/public-pos/public-pos-client";

export function PublicPosRoute() {
  const params = useSearchParams();

  return <PublicPosClient token={params.get("t") ?? ""} queryLang={params.get("lang")} />;
}
