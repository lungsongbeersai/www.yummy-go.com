"use client";

import { useSearchParams } from "next/navigation";
import { PublicPosClient } from "@/features/public-pos/order/public-pos-client";

export function PublicPosRoute({
  fontClassName,
}: {
  // ตัวแปรฟอนต์ Nightfall ส่งมาจาก route ซึ่งโหลดผ่าน next/font
  fontClassName: string;
}) {
  const params = useSearchParams();

  return (
    <PublicPosClient
      token={params.get("t") ?? ""}
      queryLang={params.get("lang")}
      fontClassName={fontClassName}
    />
  );
}
