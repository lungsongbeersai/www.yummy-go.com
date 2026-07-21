import { Suspense } from "react";
import { LoadingState } from "@/components/common/loading-state";
import { PublicPosRoute } from "@/features/public-pos/route/public-pos-route";

export default function PublicPosPage() {
  return (
    <Suspense fallback={<LoadingState variant="posGrid" />}>
      <PublicPosRoute />
    </Suspense>
  );
}
