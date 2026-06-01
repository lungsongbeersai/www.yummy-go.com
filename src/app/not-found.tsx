"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Home, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Empty className="max-w-md rounded-2xl border border-border bg-card shadow-sm">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-primary/10 text-primary">
            <SearchX className="size-7" />
          </EmptyMedia>
          <p className="text-5xl font-black tracking-tight">404</p>
          <EmptyTitle>{t("notFound.title")}</EmptyTitle>
          <EmptyDescription>{t("notFound.message")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/" className={cn(buttonVariants(), "gap-2")}>
            <Home className="size-4" />
            {t("notFound.backHome")}
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  );
}
