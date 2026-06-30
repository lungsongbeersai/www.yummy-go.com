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
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-md rounded-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("pos.editNote")}</DialogTitle>
          <DialogDescription>{t("pos.editNoteDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="public-cart-item-note" className="text-sm font-semibold">
            {t("pos.note")}
          </Label>
          <Textarea
            id="public-cart-item-note"
            value={note}
            disabled={pending}
            placeholder={t("pos.notePlaceholder")}
            className="min-h-28 resize-none text-base"
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
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
