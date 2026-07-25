"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Children-level boundary: keeps AuthGuard + AppShell (sidebar/topbar) mounted
// so back-office render errors don't strand the user without navigation.
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="max-w-md text-center">
        <CardContent className="p-6">
          <p className="text-lg font-black">{t("error.title")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
          <Button className="mt-4" onClick={reset}>
            {t("actions.tryAgain")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
