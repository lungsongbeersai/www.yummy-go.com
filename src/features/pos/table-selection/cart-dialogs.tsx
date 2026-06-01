"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConfirmAllProgress, DiscountDraft } from "./types";
import { appendCalculatorInput, discountDraftValue, normalizeDiscountType, optionalNumber } from "./utils";

export function ConfirmAllLoadingDialog({ progress }: { progress: ConfirmAllProgress | null }) {
  const { t } = useTranslation();
  const total = Math.max(progress?.total ?? 1, 1);
  const completed = Math.min(progress?.completed ?? 0, total);
  const percent = Math.round((completed / total) * 100);

  return (
    <Dialog open={Boolean(progress)} onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-[420px]"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <div className="grid size-11 place-items-center rounded-xl bg-muted text-foreground">
            <Spinner />
          </div>
          <DialogTitle className="text-base font-black">{t("pos.confirmAllTitle")}</DialogTitle>
          <DialogDescription className="max-w-[300px] text-center">
            {progress?.label ?? t("common.processing")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Progress value={percent} />
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>{progress?.detail ?? t("common.processing")}</span>
            <span>{percent}%</span>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button type="button" variant="outline" disabled>
            {t("actions.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CartPanelLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 bg-background p-4" aria-busy="true">
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </div>
  );
}

export function CartNoteDialog({
  note,
  onNoteChange,
  onOpenChange,
  onSubmit,
  open,
  pending
}: {
  note: string;
  onNoteChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  pending: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pos.editNote")}</DialogTitle>
          <DialogDescription>{t("pos.editNoteDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="cart-item-note" className="text-sm font-bold text-foreground">
            {t("pos.note")}
          </label>
          <Textarea
            id="cart-item-note"
            value={note}
            disabled={pending}
            placeholder={t("pos.notePlaceholder")}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
          <Button type="button" disabled={pending} onClick={onSubmit}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {t("pos.saveNote")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CartDiscountDialog({
  draft,
  maxAmount,
  onDraftChange,
  onOpenChange,
  onSubmit,
  open,
  pending,
  submitDisabled,
  title
}: {
  draft: DiscountDraft;
  maxAmount: number | null;
  onDraftChange: (draft: DiscountDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  pending: boolean;
  submitDisabled: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const value = optionalNumber(draft.value);
  const exceedsMax = draft.type === "AMT" && value !== null && maxAmount !== null && value > maxAmount;
  const invalid = Boolean(draft.value) && discountDraftValue(draft, maxAmount) === null;
  const displayValue = draft.value || "0";
  const displaySuffix = draft.type === "PCT" ? "%" : "K";
  const keypad = ["7", "8", "9", "delete", "4", "5", "6", "clear", "1", "2", "3", "00", "0", ".", "000"] as const;
  const helpText =
    draft.type === "PCT"
      ? t("pos.discountPercentHelp")
      : exceedsMax && maxAmount !== null
        ? t("pos.discountExceedsAmount", { amount: money(maxAmount) })
        : maxAmount !== null
          ? t("pos.discountMaxAmount", { amount: money(maxAmount) })
          : t("pos.discountAmountHelp");

  function updateCalculatorValue(input: (typeof keypad)[number]) {
    if (pending) return;
    onDraftChange({ ...draft, value: appendCalculatorInput(draft.value, input) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("pos.discountDialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <p className="text-xs font-bold text-muted-foreground">{t("pos.discountValue")}</p>
              <p
                className={cn(
                  "mt-1 truncate text-right text-3xl font-black tabular-nums text-foreground",
                  invalid && "text-destructive"
                )}
              >
                {displayValue}
                <span className="ml-1 text-base font-black text-muted-foreground">{displaySuffix}</span>
              </p>
            </div>
            <div className="w-[128px] shrink-0">
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{t("pos.discountType")}</label>
              <Select
                value={draft.type}
                disabled={pending}
                onValueChange={(value) => onDraftChange({ ...draft, type: normalizeDiscountType(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="PCT">{t("pos.percent")}</SelectItem>
                    <SelectItem value="AMT">{t("pos.amount")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {keypad.map((key) => (
              <Button
                key={key}
                type="button"
                variant={key === "clear" ? "secondary" : key === "delete" ? "outline" : "ghost"}
                className={cn(
                  "h-12 rounded-lg text-base font-black",
                  key === "0" && "col-span-2",
                  key === "clear" && "text-destructive"
                )}
                disabled={pending}
                aria-label={key === "delete" ? "Delete" : key === "clear" ? "Clear" : key}
                onClick={() => updateCalculatorValue(key)}
              >
                {key === "delete" ? "DEL" : key === "clear" ? "C" : key}
              </Button>
            ))}
          </div>
        </div>

        <p className={cn("text-xs font-medium", invalid ? "text-destructive" : "text-muted-foreground")}>
          {helpText}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
          <Button type="button" disabled={pending || submitDisabled} onClick={onSubmit}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {t("actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
