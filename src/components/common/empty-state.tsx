"use client";

import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";

export function EmptyState({ title, description }: { title?: string; description?: string }) {
  const { t } = useTranslation();

  return (
    <Empty className="min-h-48 border border-border bg-muted/25">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>{title ?? t("empty.title")}</EmptyTitle>
        <EmptyDescription>{description ?? t("empty.nothing")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
