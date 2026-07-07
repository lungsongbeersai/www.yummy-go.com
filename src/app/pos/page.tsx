import { PublicPosRoute } from "@/features/public-pos/route/public-pos-route";
import { Suspense } from "react";

export default function PublicPosPage() {
  return (
    <Suspense>
      <PublicPosRoute />
    </Suspense>
  );
}
