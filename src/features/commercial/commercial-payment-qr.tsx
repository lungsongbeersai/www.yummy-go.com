"use client";

import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Crop, RotateCcw, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommercialLabels, type CommercialLabels } from "@/features/commercial/commercial.locale";
import { CommercialQrCropError, commercialQrFileFromDataUrl, cropCommercialQrFile, isCommercialQrDataUrl, readCommercialQrSize, type CommercialQrSize } from "@/features/commercial/commercial-qr-crop";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";

export interface CommercialPaymentQrFieldProps {
  id: string;
  image?: File;
  existingSrc?: string;
  removeQr: boolean;
  disabled?: boolean;
  onChange: (image: File | undefined, removeQr: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}

interface QrCropState { x: number; y: number; zoom: number; area: Area | null }
interface QrEdit {
  file: File;
  src: string;
  size: CommercialQrSize;
  crop?: QrCropState;
  image?: File;
  existingSrc?: string;
  removeQr: boolean;
  generation: number;
}
interface RetainedQr { original: File; output: File; crop: QrCropState }

function authIdentity() {
  const auth = useAuthStore.getState();
  return JSON.stringify([auth.user?.uuid ?? "", authStoreUuid(auth.user), auth.token]);
}

function cropError(error: unknown, l: CommercialLabels) {
  if (error instanceof CommercialQrCropError) {
    if (error.code === "crop-size" || error.code === "output-size") return l("qrCropTooLarge");
    if (error.code === "input" || error.code === "dimensions") return l("qrImageInvalid");
  }
  return l("qrCropFailed");
}

/** Each URL belongs to a mounted preview and is released even under Strict Mode. */
function QrPreview({ file, existingSrc, alt }: { file?: File; existingSrc?: string; alt: string }) {
  const [preview, setPreview] = useState<{ file: File; url: string }>();
  useEffect(() => {
    if (!file) return;
    let active = true;
    const url = URL.createObjectURL(file);
    const probe = new window.Image();
    probe.onload = () => { if (active) setPreview({ file, url }); };
    probe.src = url;
    return () => { active = false; probe.onload = null; probe.src = ""; URL.revokeObjectURL(url); };
  }, [file]);
  const src = file ? preview?.file === file ? preview.url : "" : existingSrc ?? "";
  return src ? <Image src={src} alt={alt} width={160} height={160} unoptimized className="size-40 rounded-md border bg-background object-contain p-1" /> : <Skeleton className="size-40" />;
}

/** Cropping is a private form draft; neither selection nor cancellation uploads a file. */
export function CommercialPaymentQrField(props: CommercialPaymentQrFieldProps) {
  const { id, image, existingSrc, removeQr, disabled = false, onChange } = props;
  const l = useCommercialLabels();
  const session = useAuthStore(state => JSON.stringify([state.user?.uuid ?? "", authStoreUuid(state.user), state.token]));
  const [owner] = useState(session);
  const [invalidated, setInvalidated] = useState(false);
  const [edit, setEdit] = useState<QrEdit | null>(null);
  const [retained, setRetained] = useState<RetainedQr | null>(null);
  const [opening, setOpening] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observed, setObserved] = useState({ image, existingSrc, removeQr, disabled });
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const urls = useRef(new Set<string>());
  const latest = useRef(props);

  function cancelWork() {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current.clear();
  }

  useLayoutEffect(() => { latest.current = props; });
  useLayoutEffect(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current.clear();
  }, [image, existingSrc, removeQr, disabled]);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = useAuthStore.subscribe(() => {
      if (authIdentity() !== owner) {
        cancelWork();
        setInvalidated(true);
        setEdit(null);
        setRetained(null);
        setOpening(false);
        setRemoveOpen(false);
      }
    });
    return () => { mounted.current = false; unsubscribe(); cancelWork(); latest.current.onBusyChange?.(false); };
  }, [owner]);

  const active = (version: number) => mounted.current && version === generation.current && owner === authIdentity() && !latest.current.disabled;
  const selected = !removeQr && (image || isCommercialQrDataUrl(existingSrc));
  const currentEdit = edit && edit.image === image && edit.existingSrc === existingSrc && edit.removeQr === removeQr && !disabled ? edit : null;
  const busy = !invalidated && session === owner && (opening || Boolean(currentEdit));
  useLayoutEffect(() => { latest.current.onBusyChange?.(busy); }, [busy]);

  if (observed.image !== image || observed.existingSrc !== existingSrc || observed.removeQr !== removeQr || observed.disabled !== disabled) {
    setObserved({ image, existingSrc, removeQr, disabled });
    setEdit(null);
    setOpening(false);
    setRemoveOpen(false);
    setError(null);
  }

  async function openCrop(file?: File) {
    if (disabled || owner !== authIdentity()) return;
    cancelWork();
    const version = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    latest.current.onBusyChange?.(true);
    setError(null);
    setOpening(true);
    try {
      const original = file ?? (retained && retained.output === image ? retained.original : image) ?? commercialQrFileFromDataUrl(existingSrc ?? "");
      const size = await readCommercialQrSize(original, abort.signal);
      if (!active(version)) return;
      const src = URL.createObjectURL(original);
      urls.current.add(src);
      setEdit({ file: original, src, size, crop: !file && retained && retained.output === image ? retained.crop : undefined, image, existingSrc, removeQr, generation: version });
    } catch (failure) {
      if (active(version)) setError(cropError(failure, l));
    } finally { if (active(version)) setOpening(false); }
  }

  async function confirmCrop(draft: QrCropState) {
    if (!currentEdit || !active(currentEdit.generation)) return;
    const output = await cropCommercialQrFile(currentEdit.file, draft.area, controller.current?.signal);
    if (!active(currentEdit.generation)) return;
    setRetained({ original: currentEdit.file, output, crop: draft });
    setEdit(null);
    cancelWork();
    onChange(output, false);
  }

  if (session !== owner || invalidated) return null;

  return <Field>
    <FieldLabel htmlFor={id}>{l("paymentQr")}</FieldLabel>
    <Input ref={input} id={id} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void openCrop(file);
    }} />
    <p className="text-xs text-muted-foreground">{l("paymentQrHint")}</p>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {selected ? <div className="flex flex-wrap items-center gap-3"><QrPreview file={image} existingSrc={existingSrc} alt={l("paymentQr")} /><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={disabled || opening} onClick={() => { void openCrop(); }}><Crop />{l("cropQr")}</Button><Button type="button" variant="outline" className="min-h-11" disabled={disabled || opening} onClick={() => setRemoveOpen(true)}><Trash2 />{l("removeQr")}</Button></div></div> : null}
    {opening ? <p role="status" className="text-sm text-muted-foreground">{l("saving")}</p> : null}
    {currentEdit ? <QrCropDialog key={currentEdit.generation} edit={currentEdit} onCancel={() => { cancelWork(); setEdit(null); }} onConfirm={confirmCrop} /> : null}
    <AlertDialog open={removeOpen && !disabled} onOpenChange={setRemoveOpen}><AlertDialogContent className="font-lao" onKeyDown={event => event.stopPropagation()}><AlertDialogHeader><AlertDialogTitle>{l("removeQr")}</AlertDialogTitle><AlertDialogDescription>{l("removeQrConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{l("cancel")}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { cancelWork(); setEdit(null); setRetained(null); setRemoveOpen(false); setError(null); if (input.current) input.current.value = ""; onChange(undefined, true); }}>{l("remove")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </Field>;
}

function QrCropDialog({ edit, onCancel, onConfirm }: { edit: QrEdit; onCancel: () => void; onConfirm: (crop: QrCropState) => Promise<void> }) {
  const l = useCommercialLabels();
  const zoomId = useId();
  const cropper = useRef<Cropper | null>(null);
  const fitZoom = Math.min(edit.size.width / edit.size.height, edit.size.height / edit.size.width);
  const [draft, setDraft] = useState<QrCropState>(edit.crop ?? { x: 0, y: 0, zoom: fitZoom, area: null });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      // Read the current crop synchronously; the last gesture's callback can still be pending.
      const area = cropper.current?.getCropData()?.croppedAreaPixels;
      if (!area) throw new CommercialQrCropError("decode");
      await onConfirm({ ...draft, area });
    } catch (failure) { setError(cropError(failure, l)); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onCancel(); }}><DialogContent className="w-[calc(100%-1rem)] max-w-lg gap-3 p-3 font-lao sm:max-w-lg sm:p-5" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) event.preventDefault();
  }}><DialogHeader><DialogTitle>{l("cropQr")}</DialogTitle><DialogDescription>{l("qrCropHint")}</DialogDescription></DialogHeader>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    <div className="relative h-[min(32dvh,20rem)] min-h-32 w-full shrink-0 overflow-hidden rounded-lg bg-muted" aria-busy={busy}>
      <Cropper ref={cropper} image={edit.src} aspect={1} cropShape="rect" crop={{ x: draft.x, y: draft.y }} zoom={draft.zoom} minZoom={fitZoom / 2} maxZoom={4} restrictPosition={draft.zoom >= 1} roundCropAreaPixels showGrid
        cropperProps={{ tabIndex: 0, "aria-label": l("cropQr"), "aria-disabled": busy }}
        onMediaLoaded={() => setReady(true)} onCropChange={point => { if (!busy) setDraft(current => ({ ...current, ...point })); }} onZoomChange={zoom => { if (!busy) setDraft(current => ({ ...current, zoom })); }}
        onCropComplete={(_, area) => { if (!busy) setDraft(current => ({ ...current, area })); }} />
    </div>
    <Field className="gap-2"><FieldLabel htmlFor={zoomId}>{l("qrZoom")}</FieldLabel><Slider id={zoomId} className="min-h-11" aria-label={l("qrZoom")} min={fitZoom / 2} max={4} step={0.01} value={[draft.zoom]} disabled={busy} onValueChange={values => setDraft(current => ({ ...current, zoom: values[0] ?? current.zoom }))} /></Field>
    <DialogFooter className="flex-row flex-wrap gap-2 p-3"><Button type="button" variant="ghost" className="min-h-11 sm:mr-auto" disabled={busy} onClick={() => setDraft({ x: 0, y: 0, zoom: fitZoom, area: null })}><RotateCcw />{l("qrReset")}</Button><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onCancel}>{l("cancel")}</Button><Button type="button" className="min-h-11" disabled={busy || !ready} onClick={() => { void confirm(); }}>{l(busy ? "saving" : "qrConfirm")}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
