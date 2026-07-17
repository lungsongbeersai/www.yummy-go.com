"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function QRRedirect({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(publicPosRedirectUrl(token));
  }, [router, token]);

  return null;
}

export function publicPosRedirectUrl(token: string) {
  const destinationParams = new URLSearchParams({ t: token });
  return `/pos?${destinationParams.toString()}`;
}
