"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SwatchBook } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppearanceSettings } from "@/components/layout/appearance-settings";
import { cn } from "@/lib/utils";

// One header entry point for theme and color preferences. Replaces the draggable
// floating palette button (it sat on top of form fields). Language has its own
// header button so cashiers can switch it in one click.
interface DisplaySettingsMenuProps {
  className?: string;
  showLabel?: boolean;
}

export function DisplaySettingsMenu({ className, showLabel = false }: DisplaySettingsMenuProps) {
  const { t } = useTranslation();
  const id = useId();
  const label = t("app.appearance.changeColor");

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="header"
              aria-label={label}
              className={cn(
                "size-11 px-0 font-lao sm:h-9 sm:w-auto sm:px-3",
                showLabel && "w-auto px-3",
                className,
              )}
            >
              <SwatchBook />
              <span className={showLabel ? undefined : "hidden sm:inline"}>{label}</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="max-h-(--radix-popover-content-available-height) w-72 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain"
      >
        <PopoverHeader>
          <PopoverTitle>{t("app.appearance.title")}</PopoverTitle>
        </PopoverHeader>
        <AppearanceSettings idPrefix={`${id}-header-appearance`} />
      </PopoverContent>
    </Popover>
  );
}
