"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app-store";

type ThemeToggleProps = Pick<ButtonProps, "className" | "size" | "variant">;

export function ThemeToggle({ className, size = "icon", variant = "outline" }: ThemeToggleProps = {}) {
  const { t } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? t("dashboard.lightTheme") : t("dashboard.darkTheme");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={toggleTheme}
          aria-label={label}
          aria-pressed={theme === "dark"}
        >
          <Icon data-icon="inline-start" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
