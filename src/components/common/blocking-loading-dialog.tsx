"use client";

import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

interface BlockingLoadingDialogProps {
  description?: string;
  label?: string;
  open: boolean;
  progressLabel?: string;
  progressValue?: number | null;
  title?: string;
}

export function BlockingLoadingDialog({
  description,
  label,
  open,
  progressLabel,
  progressValue,
  title,
}: BlockingLoadingDialogProps) {
  const { t } = useTranslation();
  const fallbackTitle = title ?? label ?? t("common.loading");
  const fallbackDescription = description ?? t("common.processing");
  const hasProgress = typeof progressValue === "number";

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden p-0"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="gap-0 border-b bg-muted/30 p-0 text-left">
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Spinner className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-black">
                {fallbackTitle}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {fallbackDescription}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {hasProgress ? (
          <div className="grid gap-2 px-6 py-4">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
              <span className="truncate">
                {progressLabel ?? fallbackDescription}
              </span>
              <span className="shrink-0 tabular-nums">
                {Math.round(progressValue).toLocaleString("en-US")}%
              </span>
            </div>
            <Progress value={progressValue} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
