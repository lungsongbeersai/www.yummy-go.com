import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Accent of the settings pages: the theme colour the user picked (the header's palette menu
// switches --primary between emerald, blue and amber), so these pages always match the rest of
// the app. --info/--success/--warning are deliberately not used here: docs/Design.md reserves
// them for status states, and a page is not a status.
// Class names are listed in full so Tailwind can see them.
export const SETTINGS_ACCENT = {
  solid: "bg-primary text-primary-foreground",
  soft: "bg-primary/10 text-primary-text",
  wash: "bg-linear-to-br from-primary/15 via-primary/5 to-card"
} as const;

/** The soft icon tile shown beside a record in the lists. */
export function SettingsIconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", SETTINGS_ACCENT.soft)}>
      <Icon className="size-4" />
    </span>
  );
}
