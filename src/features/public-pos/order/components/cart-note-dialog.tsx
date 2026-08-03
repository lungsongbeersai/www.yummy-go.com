"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export function CartNoteDialog({
  note,
  onNoteChange,
  onOpenChange,
  onSubmit,
  open,
  pending,
}: {
  note: string;
  onNoteChange: (note: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  pending: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-[26px] border-yg-line bg-linear-to-b from-yg-bg2 to-yg-bg font-yg-sans text-yg-ink">
        <DialogHeader>
          <DialogTitle className="lao-tone-text font-yg-sans text-lg font-semibold text-yg-ink">
            {t("pos.editNote")}
          </DialogTitle>
          <DialogDescription className="text-yg-muted">
            {t("pos.editNoteDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label
            htmlFor="public-cart-item-note"
            className="text-xs font-extrabold tracking-wide text-yg-faint"
          >
            {t("pos.note")}
          </Label>
          <Textarea
            id="public-cart-item-note"
            name="orderNote"
            autoComplete="off"
            value={note}
            disabled={pending}
            placeholder={t("pos.notePlaceholder")}
            className="min-h-28 resize-none rounded-2xl border-yg-line bg-yg-panel text-base text-yg-ink placeholder:text-yg-faint focus-visible:border-yg-accent-line focus-visible:ring-yg-accent/40"
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-yg-line bg-yg-panel text-yg-ink hover:bg-yg-panel-hover hover:text-yg-ink"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl bg-yg-accent font-extrabold text-yg-on-accent hover:bg-yg-accent hover:brightness-105"
            disabled={pending}
            onClick={onSubmit}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {t("pos.saveNote")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
