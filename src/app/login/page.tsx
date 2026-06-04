import { Suspense } from "react";
import { LoginClient } from "@/features/auth/login/login-client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}
