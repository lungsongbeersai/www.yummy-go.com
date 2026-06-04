import { Suspense } from "react";
import { PublicPosRoute } from "@/features/public-pos/route/public-pos-route";

export default function PublicPosPage() {
  return (
    <Suspense>
      <PublicPosRoute />
    </Suspense>
  );
}
