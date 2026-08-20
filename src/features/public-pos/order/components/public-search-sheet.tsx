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
import { canProgrammaticallyFocusTextInput } from "@/lib/input-focus";

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
    if (!canProgrammaticallyFocusTextInput()) return;

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
        className="yg-shell inset-0 flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden border-0 p-0 font-yg-sans text-yg-ink data-[side=bottom]:h-dvh"
      >
        <SheetHeader className="shrink-0 border-b border-yg-line bg-yg-bg2/85 px-4 py-4 text-left backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3 pr-10">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong">
              <Search className="size-5" />
            </span>
            <div className="min-w-0">
              <SheetTitle className="lao-tone-text truncate font-yg-sans text-lg font-semibold leading-snug text-yg-ink">
                {t("pos.searchSheetTitle")}
              </SheetTitle>
              <SheetDescription className="line-clamp-2 text-sm font-medium text-yg-muted">
                {t("pos.searchSheetDescription")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto grid w-full max-w-2xl gap-4">
            <form className="flex gap-2" onSubmit={handleSubmit}>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-yg-faint" />
                <Input
                  ref={inputRef}
                  aria-label={t("pos.searchMenu")}
                  autoComplete="off"
                  name="menuSearch"
                  spellCheck={false}
                  value={value}
                  onChange={(event) => onValueChange(event.target.value)}
                  placeholder={t("pos.searchMenu")}
                  className="h-12.5 rounded-[15px] border-yg-line bg-yg-panel pl-10 text-base font-medium text-yg-ink shadow-none backdrop-blur-md placeholder:text-yg-faint focus-visible:border-yg-accent-line focus-visible:ring-yg-accent/40"
                />
              </div>
              <Button
                type="submit"
                className="h-12.5 rounded-[15px] bg-yg-accent px-5 font-extrabold text-yg-on-accent shadow-[0_8px_22px_-8px_var(--yg-accent)] hover:bg-yg-accent hover:brightness-105"
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

            <section className="grid gap-3 rounded-[20px] border border-yg-line bg-yg-panel p-3.5 backdrop-blur-md">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Clock3 className="size-4 shrink-0 text-yg-accent-strong" />
                  <h3 className="truncate text-xs font-extrabold tracking-wide text-yg-faint">
                    {t("pos.searchHistory")}
                  </h3>
                </div>
                {history.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 shrink-0 rounded-xl px-2.5 text-xs font-bold text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink"
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
                      className="h-12 justify-start rounded-[15px] border-yg-line bg-yg-panel2 px-3.5 text-left font-semibold text-yg-ink hover:border-yg-accent-line hover:bg-yg-panel-hover hover:text-yg-ink"
                      onClick={() => onHistorySelect(item)}
                    >
                      <Clock3 className="size-4 shrink-0 text-yg-accent-strong" />
                      <span className="lao-tone-text truncate">{item}</span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[15px] border border-dashed border-yg-line bg-yg-panel2 p-5 text-center text-sm font-semibold text-yg-muted">
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
