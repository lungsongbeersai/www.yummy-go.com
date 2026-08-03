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
    <div className="fixed right-3 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-40 sm:right-5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-full border-yg-line bg-yg-bg2/85 text-yg-muted shadow-[0_12px_30px_-12px_rgb(0_0_0/0.5)] backdrop-blur-xl hover:border-yg-accent-line hover:bg-yg-panel-hover hover:text-yg-accent-strong"
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
