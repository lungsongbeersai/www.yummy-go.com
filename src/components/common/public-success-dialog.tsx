"use client";

import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PublicSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
}

export function PublicSuccessDialog({
  open,
  onOpenChange,
  message,
}: PublicSuccessDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-60 bg-yg-ink/40"
        className="yg-shell z-61 max-h-[calc(100dvh-2rem)] max-w-[min(360px,calc(100%-2rem))] gap-6 overflow-y-auto rounded-2xl border border-yg-line bg-yg-panel p-6 font-yg-sans text-yg-ink shadow-xl sm:max-w-sm"
      >
        <DialogHeader className="items-center gap-4 text-center">
          <DialogTitle className="font-yg-sans text-lg font-semibold text-yg-ink">
            {t("publicSuccess.title")}
          </DialogTitle>
          <span
            aria-hidden="true"
            className="flex size-20 items-center justify-center rounded-full bg-yg-accent-soft text-yg-accent motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-300"
          >
            <CircleCheck className="size-11" strokeWidth={1.8} />
          </span>
          <DialogDescription className="text-center text-base leading-relaxed text-yg-ink">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button className="h-12 w-full rounded-lg bg-yg-accent text-base font-medium text-yg-on-accent hover:bg-yg-accent-strong">
            {t("publicSuccess.close")}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
