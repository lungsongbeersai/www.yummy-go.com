import { Suspense } from "react";
import { PublicPosRoute } from "@/features/public-pos/public-pos-route";

export default function PublicPosPage() {
  return (
    <Suspense>
      <PublicPosRoute />
    </Suspense>
  );
}
