"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommercialPaymentQrField } from "@/features/commercial/commercial-payment-qr";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import type { CommercialPaymentCurrency, CommercialPaymentProfile, SaveCommercialPaymentProfileInput } from "@/services/commercial";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCommercialStore } from "@/stores/commercial-store";
import { useToastStore } from "@/stores/toast-store";

interface PaymentProfileRow {
  profile_uuid: string;
  account_name: string;
  account_number: string;
  currency: CommercialPaymentCurrency;
  image?: File;
  remove_qr: boolean;
}

interface CommercialPaymentProfileEditorProps {
  profile?: CommercialPaymentProfile;
  remaining: number;
  onClose: () => void;
  onSaved: (profiles: CommercialPaymentProfile[]) => void;
}

function newRow(profile?: CommercialPaymentProfile): PaymentProfileRow {
  return { profile_uuid: profile?.profile_uuid ?? crypto.randomUUID(), account_name: profile?.account_name ?? "", account_number: profile?.account_number ?? "", currency: profile?.currency ?? "LAK", remove_qr: false };
}

function privateSession() {
  const { user, token } = useAuthStore.getState();
  return `${user?.uuid ?? ""}:${authStoreUuid(user)}:${token ?? ""}`;
}

export function CommercialPaymentProfileEditor({ profile, remaining, onClose, onSaved }: CommercialPaymentProfileEditorProps) {
  const l = useCommercialLabels();
  const { savePaymentProfile, savePaymentProfiles, paymentProfilesSaving, paymentProfilesError } = useCommercialStore();
  const showToast = useToastStore((state) => state.show);
  const [rows, setRows] = useState<PaymentProfileRow[]>(() => [newRow(profile)]);
  const [removeRow, setRemoveRow] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const busyQrRows = useRef(new Set<string>());
  const mounted = useRef(true);
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const saving = pending || paymentProfilesSaving;
  const maximumRows = profile ? 1 : Math.min(3, Math.max(0, remaining));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function updateRow(id: string, changes: Partial<PaymentProfileRow>) {
    if (saving || submitting.current) return;
    setRows((current) => current.map((row) => row.profile_uuid === id ? { ...row, ...changes } : row));
  }

  function qrBusyChanged(id: string, busy: boolean) {
    if (busy) busyQrRows.current.add(id);
    else busyQrRows.current.delete(id);
    if (mounted.current) setQrBusy(busyQrRows.current.size > 0);
  }

  function revealInvalid(control: HTMLInputElement | null) {
    if (!control) return;
    control.focus({ preventScroll: true });
    const pane = body.current;
    if (pane) pane.scrollBy({ top: control.getBoundingClientRect().top - pane.getBoundingClientRect().top - Math.max(0, (pane.clientHeight - control.offsetHeight) / 2), behavior: "smooth" });
    control.reportValidity();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (saving || submitting.current || busyQrRows.current.size) return;
    const blank = rows.find((row) => !row.account_name.trim() || !row.account_number.trim());
    const invalid = event.currentTarget.querySelector<HTMLInputElement>("input:invalid");
    if (blank || invalid || rows.length > maximumRows) {
      setValidation(l(rows.length > maximumRows ? "paymentProfilesLimit" : "paymentProfileRequired"));
      revealInvalid(blank ? form.current?.querySelector<HTMLInputElement>(`#payment-${blank.profile_uuid}-${blank.account_name.trim() ? "number" : "name"}`) ?? null : invalid);
      return;
    }
    const identity = privateSession();
    const inputs: SaveCommercialPaymentProfileInput[] = rows.map((row) => ({ profile_uuid: row.profile_uuid, account_name: row.account_name.trim(), account_number: row.account_number.trim(), currency: row.currency, remove_qr: row.remove_qr, ...(row.image ? { qr_image: row.image } : {}) }));
    submitting.current = true;
    setPending(true);
    setValidation(null);
    try {
      const saved = profile ? await savePaymentProfile(inputs[0]).then((row) => row ? [row] : null) : await savePaymentProfiles(inputs);
      if (!mounted.current || privateSession() !== identity || !saved) return;
      showToast({ title: l("saved"), tone: "success" });
      onSaved(saved);
    } catch { /* Preserve every private draft row and show the store error. */ }
    finally {
      submitting.current = false;
      if (mounted.current && privateSession() === identity) setPending(false);
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving && !submitting.current) onClose(); }}>
    <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 font-lao sm:max-w-2xl" showCloseButton={!saving} onKeyDown={(event) => event.stopPropagation()} onEscapeKeyDown={(event) => { if (saving || submitting.current) event.preventDefault(); }}>
      <DialogHeader className="shrink-0"><DialogTitle>{l(profile ? "editPaymentProfile" : "addPaymentProfile")}</DialogTitle><DialogDescription>{l("privatePaymentHint")}</DialogDescription></DialogHeader>
      <form ref={form} noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={submit} onInvalidCapture={(event) => event.stopPropagation()}>
        <div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="grid min-w-0 gap-4 [&_input]:min-h-11">
            {validation || paymentProfilesError ? <Alert variant="destructive"><AlertDescription>{validation || paymentProfilesError}</AlertDescription></Alert> : null}
            {qrBusy ? <p role="status" className="text-xs text-muted-foreground">{l("paymentQrBusy")}</p> : null}
            {!profile ? <p className="text-xs text-muted-foreground">{l("paymentProfilesBatchHint")}</p> : null}
            {rows.map((row, index) => <section key={row.profile_uuid} className="grid min-w-0 gap-4 rounded-lg border p-3 sm:p-4" aria-label={`${l("paymentAccountRow")} ${index + 1}`}>
              <div className="flex min-w-0 items-center justify-between gap-3"><h3 className="font-semibold">{l("paymentAccountRow")} {index + 1}</h3>{!profile && rows.length > 1 ? <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`${l("removePaymentProfileRow")} ${index + 1}`} disabled={saving} onClick={() => setRemoveRow(row.profile_uuid)}><Trash2 /></Button> : null}</div>
              <Field><FieldLabel htmlFor={`payment-${row.profile_uuid}-name`}>{l("accountName")} *</FieldLabel><Input id={`payment-${row.profile_uuid}-name`} value={row.account_name} maxLength={200} autoComplete="off" required disabled={saving} onChange={(event) => updateRow(row.profile_uuid, { account_name: event.target.value })} /></Field>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]"><Field><FieldLabel htmlFor={`payment-${row.profile_uuid}-number`}>{l("accountNumber")} *</FieldLabel><Input id={`payment-${row.profile_uuid}-number`} value={row.account_number} maxLength={100} autoComplete="off" required disabled={saving} onChange={(event) => updateRow(row.profile_uuid, { account_number: event.target.value })} /></Field><Field><FieldLabel htmlFor={`payment-${row.profile_uuid}-currency`}>{l("currency")}</FieldLabel><Select value={row.currency} onValueChange={(currency) => updateRow(row.profile_uuid, { currency: currency === "THB" || currency === "USD" ? currency : "LAK" })} disabled={saving}><SelectTrigger id={`payment-${row.profile_uuid}-currency`} className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{["LAK", "THB", "USD"].map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select></Field></div>
              <CommercialPaymentQrField id={`payment-${row.profile_uuid}-qr`} image={row.image} existingSrc={profile?.qr_image ?? undefined} removeQr={row.remove_qr} disabled={saving} onChange={(image, removeQr) => updateRow(row.profile_uuid, { image, remove_qr: removeQr })} onBusyChange={(busy) => qrBusyChanged(row.profile_uuid, busy)} />
            </section>)}
            {!profile ? <div className="grid gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={saving || rows.length >= maximumRows} onClick={() => { if (!saving) setRows((current) => current.length < maximumRows ? [...current, newRow()] : current); }}><Plus />{l("addPaymentProfileRow")}</Button><p className="text-xs text-muted-foreground">{l("paymentProfilesChooseAfterSave")}</p></div> : null}
          </div>
        </div>
        <DialogFooter className="shrink-0 flex-row"><Button type="button" variant="outline" className="flex-1 sm:flex-none" disabled={saving} onClick={onClose}>{l("cancel")}</Button><Button type="submit" className="flex-1 sm:flex-none" disabled={saving || qrBusy || rows.length > maximumRows}>{l(saving ? "saving" : profile ? "savePaymentProfile" : "savePaymentProfiles")}</Button></DialogFooter>
      </form>
    </DialogContent>
    <AlertDialog open={removeRow !== null} onOpenChange={(open) => { if (!open && !saving) setRemoveRow(null); }}><AlertDialogContent className="font-lao" onKeyDown={(event) => event.stopPropagation()}><AlertDialogHeader><AlertDialogTitle>{l("removePaymentProfileRow")}</AlertDialogTitle><AlertDialogDescription>{l("removePaymentProfileRowConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>{l("cancel")}</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={saving} onClick={() => { if (!saving) { setRows((current) => current.length > 1 ? current.filter((row) => row.profile_uuid !== removeRow) : current); setRemoveRow(null); } }}>{l("remove")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </Dialog>;
}
