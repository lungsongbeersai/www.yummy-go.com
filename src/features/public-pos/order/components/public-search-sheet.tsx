"use client";

import { type FormEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Clock3, Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function PublicSearchSheet({
  open,
  value,
  history,
  loading,
  onOpenChange,
  onValueChange,
  onSubmit,
  onHistorySelect,
  onClearHistory,
}: {
  open: boolean;
  value: string;
  history: string[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onHistorySelect: (value: string) => void;
  onClearHistory: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 90);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="inset-0 flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden border-0 bg-[#f3fbf7] p-0 dark:bg-app"
      >
        <SheetHeader className="shrink-0 border-b border-emerald-100 bg-white/95 px-4 py-4 text-left backdrop-blur-xl dark:border-border dark:bg-background/95">
          <div className="flex min-w-0 items-center gap-3 pr-10">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-emerald-950/10">
              <Search className="size-5" />
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-black leading-6">
                {t("pos.searchSheetTitle")}
              </SheetTitle>
              <SheetDescription className="line-clamp-2 text-sm font-medium">
                {t("pos.searchSheetDescription")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto grid w-full max-w-2xl gap-4">
            <form className="flex gap-2" onSubmit={handleSubmit}>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={value}
                  onChange={(event) => onValueChange(event.target.value)}
                  placeholder={t("pos.searchMenu")}
                  className="h-12 rounded-lg border-emerald-100 bg-white pl-10 text-base font-semibold shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background"
                />
              </div>
              <Button
                type="submit"
                className="h-12 rounded-lg px-4"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                <span className="hidden sm:inline">{t("actions.search")}</span>
              </Button>
            </form>

            <section className="grid gap-3 rounded-xl border border-emerald-100 bg-white/85 p-3 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background/85">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Clock3 className="size-4 shrink-0 text-primary" />
                  <h3 className="truncate text-sm font-black">
                    {t("pos.searchHistory")}
                  </h3>
                </div>
                {history.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 rounded-md px-2 text-xs"
                    onClick={onClearHistory}
                  >
                    <Trash2 className="size-3.5" />
                    {t("pos.clearSearchHistory")}
                  </Button>
                ) : null}
              </div>

              {history.length ? (
                <div className="grid gap-2">
                  {history.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant="outline"
                      className="h-11 justify-start rounded-lg border-emerald-100 bg-white px-3 text-left font-semibold shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background"
                      onClick={() => onHistorySelect(item)}
                    >
                      <Clock3 className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{item}</span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-emerald-100 bg-emerald-50/45 p-5 text-center text-sm font-semibold text-muted-foreground dark:border-border dark:bg-muted/25">
                  {t("pos.searchHistoryEmpty")}
                </div>
              )}
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
