import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DateFilterButtonProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

export function DateFilterButton({
  ariaLabel,
  className,
  disabled,
  label,
  onClick,
}: DateFilterButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={ariaLabel}
      disabled={disabled}
      title={label}
      className={cn(
        "min-h-11 min-w-0 max-w-full justify-start gap-1.5 rounded-full border-primary/25 bg-primary/5 px-3 text-xs font-bold text-primary shadow-none hover:bg-primary/10 hover:text-primary focus-visible:ring-primary/30 sm:min-h-8",
        className,
      )}
      onClick={onClick}
    >
      <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" data-icon="inline-start" />
      <span className="min-w-0 truncate tabular-nums">{label}</span>
      <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
    </Button>
  );
}
