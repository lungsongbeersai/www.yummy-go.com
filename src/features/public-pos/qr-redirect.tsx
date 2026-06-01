"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function QRRedirect({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/pos?t=${encodeURIComponent(token)}`);
  }, [router, token]);

  return null;
}
