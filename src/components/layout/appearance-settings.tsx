"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppearanceControls, type AppearanceControlsSize } from "@/components/layout/appearance-controls";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useAppStore, type ThemeMode } from "@/stores/app-store";

interface AppearanceSettingsProps {
  idPrefix: string;
  size?: AppearanceControlsSize;
}

export function AppearanceSettings({ idPrefix, size = "compact" }: AppearanceSettingsProps) {
  const { t } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  return (
    <>
      <FieldSet>
        <FieldLegend variant="label">{t("app.appearance.modeLabel")}</FieldLegend>
        <ToggleGroup
          type="single"
          variant="outline"
          value={theme}
          onValueChange={(value) => {
            if (value) setTheme(value as ThemeMode);
          }}
          className="w-full"
        >
          <ToggleGroupItem value="light" className={cn("flex-1", size === "touch" && "min-h-11")}>
            <Sun data-icon="inline-start" />
            {t("app.appearance.modes.light")}
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className={cn("flex-1", size === "touch" && "min-h-11")}>
            <Moon data-icon="inline-start" />
            {t("app.appearance.modes.dark")}
          </ToggleGroupItem>
        </ToggleGroup>
      </FieldSet>
      <Separator />
      <AppearanceControls idPrefix={idPrefix} size={size} />
    </>
  );
}
