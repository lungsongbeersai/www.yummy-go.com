"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { validCommercialItem } from "@/features/commercial/commercial-domain";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import type { CatalogItem } from "@/services/commercial";
import { useCommercialStore } from "@/stores/commercial-store";
import { useToastStore } from "@/stores/toast-store";

export interface CommercialItemSeed {
  name: string;
  unit_price: number;
  unit: string;
}

interface CommercialItemEditorProps {
  branchUuid: string;
  item?: CatalogItem;
  seed?: CommercialItemSeed;
  onClose: () => void;
}

export function CommercialItemEditor({ branchUuid, item, seed, onClose }: CommercialItemEditorProps) {
  const l = useCommercialLabels();
  const saveItem = useCommercialStore((state) => state.saveItem);
  const saving = useCommercialStore((state) => state.saving);
  const error = useCommercialStore((state) => state.error);
  const showToast = useToastStore((state) => state.show);
  const [name, setName] = useState(item?.name ?? seed?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unit, setUnit] = useState(item?.unit ?? seed?.unit ?? "");
  const [price, setPrice] = useState(String(item?.unit_price ?? seed?.unit_price ?? 0));
  const [visible, setVisible] = useState(item?.image_visible ?? true);
  const [active, setActive] = useState(item?.active ?? true);
  const [image, setImage] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const photo = image ? previewUrl : removeImage ? "" : item?.image_url ?? "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!validCommercialItem(name, price)) { setValidation(l("itemRequired")); return; }
    setValidation(null);
    try {
      const result = await saveItem({
        branch_uuid: branchUuid, ...(item ? { item_uuid: item.item_uuid } : {}),
        name: name.trim(), description: description.trim(), unit: unit.trim(), unit_price: Number(price),
        image_visible: visible, active, remove_image: removeImage, ...(image ? { image } : {}),
      });
      if (!result) return;
      showToast({ title: l("saved"), tone: "success" });
      onClose();
    } catch {
      // The store keeps the error visible without discarding the form.
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="font-lao sm:max-w-xl" showCloseButton={!saving}>
        <DialogHeader><DialogTitle>{l(item ? "editItem" : "addItem")}</DialogTitle><DialogDescription>{l("emptyCatalogHint")}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="grid gap-5">
          {validation || error ? <Alert variant="destructive"><AlertDescription>{validation || error}</AlertDescription></Alert> : null}
          <Field><FieldLabel htmlFor="commercial-item-name">{l("name")} *</FieldLabel><Input id="commercial-item-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={250} disabled={saving} autoFocus /></Field>
          <Field><FieldLabel htmlFor="commercial-item-description">{l("description")}</FieldLabel><Textarea id="commercial-item-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={3000} disabled={saving} /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="commercial-item-unit">{l("unit")}</FieldLabel><Input id="commercial-item-unit" value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={60} disabled={saving} /></Field>
            <Field><FieldLabel htmlFor="commercial-item-price">{l("price")} *</FieldLabel><Input id="commercial-item-price" type="number" inputMode="numeric" min="0" step="1" value={price} onChange={(event) => setPrice(event.target.value)} required disabled={saving} /></Field>
          </div>
          <Field>
            <FieldLabel htmlFor="commercial-item-photo">{l("photo")}</FieldLabel>
            <Input ref={photoInput} id="commercial-item-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
                setValidation(l("photoInvalid")); event.target.value = ""; return;
              }
              setValidation(null); setRemoveImage(false); setImage(file); setPreviewUrl(URL.createObjectURL(file));
            }} />
            <p className="text-xs text-muted-foreground">{l("photoHint")}</p>
            {photo ? <div className="flex flex-wrap items-center gap-3"><Image src={photo} alt={name || l("photo")} width={120} height={90} unoptimized className="h-24 w-32 rounded-md border bg-muted object-contain" /><Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => setRemoveOpen(true)}>{l("removePhoto")}</Button></div> : null}
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4"><span>{l("showItemImage")}</span><Switch checked={visible} onCheckedChange={setVisible} disabled={saving} /></label>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4"><span>{l("active")}</span><Switch checked={active} onCheckedChange={setActive} disabled={saving} /></label>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={saving}>{l("close")}</Button><Button type="submit" disabled={saving}>{l(saving ? "saving" : "save")}</Button></DialogFooter>
        </form>
        <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}><AlertDialogContent className="font-lao"><AlertDialogHeader><AlertDialogTitle>{l("removePhoto")}</AlertDialogTitle><AlertDialogDescription>{l("removePhotoConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{l("cancel")}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setImage(undefined); setPreviewUrl(""); setRemoveImage(true); if (photoInput.current) photoInput.current.value = ""; }}>{l("remove")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
