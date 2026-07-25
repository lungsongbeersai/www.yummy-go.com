import { Suspense } from "react";
import { LoadingState } from "@/components/common/loading-state";
import { LoginClient } from "@/features/auth/login/login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState variant="page" />}>
      <LoginClient />
    </Suspense>
  );
}
