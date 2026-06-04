"use client";

import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ScrollJumpEdge } from "@/features/public-pos/order/types";

export function ScrollJumpControls({
  edge,
  onScroll,
}: {
  edge: ScrollJumpEdge;
  onScroll: () => void;
}) {
  const { t } = useTranslation();
  const scrollToTop = edge === "top";
  const label = t(scrollToTop ? "pos.scrollToTop" : "pos.scrollToBottom");
  const Icon = scrollToTop ? ArrowUp : ArrowDown;

  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-40 sm:right-5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 rounded-full border-emerald-100 bg-background/95 text-muted-foreground shadow-lg shadow-emerald-950/10 backdrop-blur-xl hover:border-primary/30 hover:bg-primary/10 hover:text-primary dark:border-border"
            aria-label={label}
            onClick={onScroll}
          >
            <Icon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
