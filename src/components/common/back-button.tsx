"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  fallbackHref: string;
  label?: string;
  className?: string;
}

export function BackButton({ fallbackHref, label, className }: BackButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn("h-auto gap-2 px-2 py-1 text-sm font-bold text-primary hover:bg-primary/10", className)}
    >
      <ArrowLeft data-icon="inline-start" />
      {label ?? t("common.back")}
    </Button>
  );
}
