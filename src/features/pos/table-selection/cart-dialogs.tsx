"use client";

import type { KeyboardEvent } from "react";
import {
  BadgePercent,
  Banknote,
  Delete,
  Percent,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { money } from "@/lib/format";
import { formatNumberInput } from "@/lib/number-format";
import { cn } from "@/lib/utils";
import type { ConfirmAllProgress, DiscountDraft } from "./types";
import {
  appendDiscountCalculatorInput,
  discountDraftValue,
  discountDraftWithType,
  normalizeDiscountType,
  optionalNumber
} from "./utils";

const DISCOUNT_KEYPAD_KEYS = [
  "7",
  "8",
  "9",
  "delete",
  "4",
  "5",
  "6",
  "clear",
  "1",
  "2",
  "3",
  "00",
  "0",
  ".",
  "000",
] as const;

type DiscountKeypadKey = (typeof DISCOUNT_KEYPAD_KEYS)[number];

export function ConfirmAllLoadingDialog({ progress }: { progress: ConfirmAllProgress | null }) {
  const { t } = useTranslation();
  const total = Math.max(progress?.total ?? 1, 1);
  const completed = Math.min(progress?.completed ?? 0, total);
  const percent = Math.round((completed / total) * 100);

  return (
    <BlockingLoadingDialog
      open={Boolean(progress)}
      title={t("pos.confirmAllTitle")}
      description={progress?.label ?? t("common.processing")}
      progressLabel={progress?.detail ?? t("common.processing")}
      progressValue={percent}
    />
  );
}

export function CartPanelLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-0 bg-muted/35" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="border-b border-border bg-background px-3 py-3">
          <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
            <Skeleton className="size-12 rounded-md" />
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="grid min-w-0 flex-1 gap-2">
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="mt-4 flex justify-end">
                <Skeleton className="h-11 w-36 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
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
          <Label htmlFor="cart-item-note" className="text-sm font-bold text-foreground">
            {t("pos.note")}
          </Label>
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
  const displayValue = formatNumberInput(draft.value, { decimal: true }) || "0";
  const displaySuffix = draft.type === "PCT" ? "%" : "₭";
  const helpText =
    draft.type === "PCT"
      ? t("pos.discountPercentHelp")
      : exceedsMax && maxAmount !== null
        ? t("pos.discountExceedsAmount", { amount: money(maxAmount) })
        : maxAmount !== null
          ? t("pos.discountMaxAmount", { amount: money(maxAmount) })
          : t("pos.discountAmountHelp");

  function updateCalculatorValue(input: DiscountKeypadKey) {
    if (pending) return;
    onDraftChange({ ...draft, value: appendDiscountCalculatorInput(draft, input) });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (pending || event.altKey || event.ctrlKey || event.metaKey) return;

    let input: DiscountKeypadKey | null = null;
    if (/^\d$/.test(event.key)) input = event.key as DiscountKeypadKey;
    if (event.key === "." || event.key === ",") input = ".";
    if (event.key === "Backspace" || event.key === "Delete") input = "delete";
    if (!input) return;

    event.preventDefault();
    updateCalculatorValue(input);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-busy={pending}
        className="flex max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 motion-reduce:animate-none motion-reduce:transition-none sm:max-w-120"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="shrink-0 px-5 pb-4 pr-16 pt-5 text-left">
          <div className="flex min-w-0 items-start gap-3">
            <div
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
            >
              <BadgePercent className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-balance text-xl leading-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-pretty leading-relaxed">
                {t("pos.discountDialogDescription")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Separator />

        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <FieldGroup className="gap-4">
            <Field data-disabled={pending} className="gap-2">
              <FieldTitle id="discount-type-label">
                {t("pos.discountType")}
              </FieldTitle>
              <ToggleGroup
                type="single"
                value={draft.type}
                variant="outline"
                spacing={2}
                disabled={pending}
                aria-labelledby="discount-type-label"
                className="grid w-full grid-cols-2"
                onValueChange={(nextType) => {
                  if (!nextType) return;
                  onDraftChange(
                    discountDraftWithType(draft, normalizeDiscountType(nextType)),
                  );
                }}
              >
                <ToggleGroupItem
                  value="PCT"
                  className="h-12 w-full touch-manipulation font-bold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <Percent aria-hidden="true" data-icon="inline-start" />
                  {t("pos.percent")}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="AMT"
                  className="h-12 w-full touch-manipulation font-bold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <Banknote aria-hidden="true" data-icon="inline-start" />
                  {t("pos.amount")}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <Field data-invalid={invalid} className="gap-2">
              <FieldTitle id="discount-value-label">
                {t("pos.discountValue")}
              </FieldTitle>
              <div
                className={cn(
                  "rounded-xl border border-border bg-muted/30 p-4 shadow-inner",
                  invalid && "border-destructive/60",
                )}
              >
                <output
                  role="status"
                  aria-atomic="true"
                  aria-labelledby="discount-value-label"
                  aria-live="polite"
                  className={cn(
                    "flex min-w-0 items-baseline justify-end gap-2 text-right text-4xl font-black tabular-nums text-foreground",
                    invalid && "text-destructive",
                  )}
                >
                  <span className="truncate">{displayValue}</span>
                  <span className="shrink-0 text-lg text-muted-foreground">
                    {displaySuffix}
                  </span>
                </output>
              </div>
              {invalid ? (
                <FieldError>{helpText}</FieldError>
              ) : (
                <FieldDescription>{helpText}</FieldDescription>
              )}
            </Field>

            <Field className="gap-2">
              <FieldTitle id="discount-keypad-label" className="sr-only">
                {t("pos.discountValue")}
              </FieldTitle>
              <div
                role="group"
                aria-labelledby="discount-keypad-label"
                className="grid grid-cols-4 gap-2"
              >
                {DISCOUNT_KEYPAD_KEYS.map((key) => {
                  const isDelete = key === "delete";
                  const isClear = key === "clear";
                  const ariaLabel = isDelete
                    ? t("pos.backspaceAmount")
                    : isClear
                      ? t("actions.clear")
                      : key;

                  return (
                    <Button
                      key={key}
                      type="button"
                      size="lg"
                      variant={isDelete ? "secondary" : "outline"}
                      aria-keyshortcuts={
                        isDelete ? "Backspace Delete" : undefined
                      }
                      aria-label={ariaLabel}
                      title={isDelete || isClear ? ariaLabel : undefined}
                      className={cn(
                        "h-12 w-full touch-manipulation rounded-xl text-lg font-black tabular-nums",
                        key === "0" && "col-span-2",
                        isClear && "text-destructive",
                      )}
                      disabled={pending}
                      onClick={() => updateCalculatorValue(key)}
                    >
                      {isDelete ? (
                        <Delete aria-hidden="true" data-icon="inline-start" />
                      ) : isClear ? (
                        <RotateCcw
                          aria-hidden="true"
                          data-icon="inline-start"
                        />
                      ) : (
                        key
                      )}
                    </Button>
                  );
                })}
              </div>
            </Field>
          </FieldGroup>
        </div>

        <Separator />
        <DialogFooter className="grid shrink-0 grid-cols-2 bg-muted/20 p-4 sm:grid-cols-2 sm:px-5">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full touch-manipulation"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            type="button"
            size="lg"
            className="w-full touch-manipulation"
            disabled={pending || submitDisabled}
            onClick={onSubmit}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {t("actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
