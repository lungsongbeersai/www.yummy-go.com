"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { commercialPaymentProfileSnapshot, validCommercialPaymentDraft, type CommercialPaymentDraft } from "@/features/commercial/commercial-payment";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import type { CommercialPaymentCurrency, CommercialPaymentProfile } from "@/services/commercial";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCommercialStore } from "@/stores/commercial-store";
import { useToastStore } from "@/stores/toast-store";

interface CommercialPaymentFieldsProps {
  value: CommercialPaymentDraft;
  onChange: (value: CommercialPaymentDraft) => void;
  active: boolean;
  disabled: boolean;
  legacyBankDetails?: string;
}

export function CommercialPaymentFields({ value, onChange, active, disabled, legacyBankDetails }: CommercialPaymentFieldsProps) {
  const l = useCommercialLabels();
  const { paymentProfiles, paymentOwnerUuid, paymentProfilesLoading, paymentProfilesError, loadPaymentProfiles } = useCommercialStore();
  const ownerKey = useAuthStore((state) => state.user?.uuid ? `${state.user.uuid}:${authStoreUuid(state.user)}` : "");
  const token = useAuthStore((state) => state.token);
  const profiles = ownerKey === paymentOwnerUuid ? paymentProfiles : [];
  const [editing, setEditing] = useState<CommercialPaymentProfile | null | undefined>();
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (active) void loadPaymentProfiles().catch(() => {});
  }, [active, ownerKey, token, loadPaymentProfiles]);

  function saved(profile: CommercialPaymentProfile) {
    // A retained document snapshot changes only through its explicit refresh.
    onChange({ ...value, accounts: value.accounts.map((account) => !account.snapshot_uuid && account.profile_uuid === profile.profile_uuid ? commercialPaymentProfileSnapshot(profile) : account) });
    setEditing(undefined);
  }

  return <section className="grid min-w-0 gap-4 rounded-lg border bg-card p-3 sm:p-4" aria-label={l("paymentFooter")}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="font-semibold">{l("paymentFooter")}</h3><p className="mt-1 text-xs text-muted-foreground">{l("privatePaymentHint")}</p></div><Button type="button" data-payment-focus variant="outline" className="min-h-11" disabled={disabled || paymentProfilesLoading || profiles.length >= 20} onClick={() => setEditing(null)}><Plus />{l("addPaymentProfile")}</Button></div>
    <div className="grid gap-2"><label className="flex min-h-11 cursor-pointer items-center justify-between gap-3"><span>{l("showPaymentAccounts")}</span><Switch checked={value.show_accounts} onCheckedChange={(checked) => onChange({ ...value, show_accounts: checked })} disabled={disabled} /></label><label className="flex min-h-11 cursor-pointer items-center justify-between gap-3"><span>{l("showPaymentQr")}</span><Switch checked={value.show_qr} onCheckedChange={(checked) => onChange({ ...value, show_qr: checked })} disabled={disabled} /></label></div>
    <p className="text-xs text-muted-foreground">{l("paymentSharingHint")}</p>
    {paymentProfilesError ? <Alert variant="destructive"><AlertDescription>{paymentProfilesError}<Button type="button" variant="outline" className="min-h-11" disabled={disabled || paymentProfilesLoading} onClick={() => { void loadPaymentProfiles().catch(() => {}); }}>{l("retry")}</Button></AlertDescription></Alert> : null}
    {paymentProfilesLoading ? <Skeleton className="h-11 w-full" /> : <Field><FieldLabel htmlFor="commercial-payment-profile">{l("choosePaymentProfile")}</FieldLabel><Select value="" disabled={disabled || !profiles.length || value.accounts.length >= 3} onValueChange={(id) => { const profile = profiles.find((row) => row.profile_uuid === id); if (profile) onChange({ ...value, accounts: [...value.accounts, commercialPaymentProfileSnapshot(profile)] }); }}><SelectTrigger data-payment-focus id="commercial-payment-profile" className="h-11 w-full min-w-0"><SelectValue placeholder={l("choosePaymentProfile")} /></SelectTrigger><SelectContent>{profiles.filter((profile) => !value.accounts.some((account) => account.profile_uuid === profile.profile_uuid)).map((profile) => <SelectItem key={profile.profile_uuid} value={profile.profile_uuid} className="min-h-11"><span className="max-w-64 truncate">{profile.label} · {profile.currency}</span></SelectItem>)}</SelectContent></Select></Field>}
    {!profiles.length && !paymentProfilesLoading && !paymentProfilesError ? <p className="text-sm text-muted-foreground">{l("emptyPaymentProfiles")}</p> : null}
    {value.accounts.map((account, index) => {
      const current = profiles.find((profile) => profile.profile_uuid === account.profile_uuid);
      return <div key={account.snapshot_uuid || account.profile_uuid || index} className="grid min-w-0 gap-2 rounded-md border p-3"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{account.label} · {account.currency}</p><p className="break-words text-xs text-muted-foreground">{account.bank_name} · {account.account_name}</p><p className="break-all text-sm tabular-nums">{account.account_number || l("paymentNumberNotIncluded")}</p>{account.snapshot_uuid ? <p className="text-xs text-muted-foreground">{l("savedPaymentSnapshot")}</p> : null}</div><Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`${l("removePaymentAccount")} ${account.label}`} disabled={disabled} onClick={() => setRemoveIndex(index)}><Trash2 /></Button></div>{account.qr_image ? <Image src={account.qr_image} alt={`${l("paymentQr")} ${account.label}`} width={128} height={128} unoptimized className="size-28 rounded-md border bg-background object-contain p-1" /> : null}{account.snapshot_uuid && current ? <Button type="button" variant="outline" className="min-h-11 whitespace-normal" disabled={disabled} onClick={() => onChange({ ...value, accounts: value.accounts.map((row, position) => position === index ? commercialPaymentProfileSnapshot(current) : row) })}><RefreshCw />{l("refreshPaymentProfile")}</Button> : null}</div>;
    })}
    <p className="text-xs text-muted-foreground">{l("paymentSnapshotHint")}</p>
    {legacyBankDetails?.trim() ? <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{l("legacyBankHint")}</p> : null}
    {(value.show_accounts || value.show_qr) && !validCommercialPaymentDraft(value, legacyBankDetails) ? <Alert><AlertDescription>{l("paymentSelectionRequired")}</AlertDescription></Alert> : null}
    {profiles.length ? <details className="min-w-0 rounded-md border p-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">{l("managePaymentProfiles")}</summary><div className="grid gap-2 pt-3">{profiles.map((profile) => <div key={profile.profile_uuid} className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm">{profile.label} · {profile.currency}</p><p className="truncate text-xs text-muted-foreground">{profile.bank_name}</p></div><Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => setEditing(profile)} aria-label={`${l("editPaymentProfile")} ${profile.label}`}><Pencil />{l("edit")}</Button></div>)}</div></details> : null}
    {editing !== undefined ? <CommercialPaymentProfileEditor key={editing?.profile_uuid ?? "new"} profile={editing ?? undefined} onClose={() => setEditing(undefined)} onSaved={saved} /> : null}
    <AlertDialog open={removeIndex !== null} onOpenChange={(open) => { if (!open) setRemoveIndex(null); }}><AlertDialogContent className="font-lao"><AlertDialogHeader><AlertDialogTitle>{l("removePaymentAccount")}</AlertDialogTitle><AlertDialogDescription>{l("removePaymentAccountConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{l("cancel")}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { onChange({ ...value, accounts: value.accounts.filter((_, index) => index !== removeIndex) }); setRemoveIndex(null); }}>{l("remove")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

interface CommercialPaymentProfileEditorProps { profile?: CommercialPaymentProfile; onClose: () => void; onSaved: (profile: CommercialPaymentProfile) => void }

function CommercialPaymentProfileEditor({ profile, onClose, onSaved }: CommercialPaymentProfileEditorProps) {
  const l = useCommercialLabels();
  const { savePaymentProfile, paymentProfilesSaving: saving, paymentProfilesError: error } = useCommercialStore();
  const showToast = useToastStore((state) => state.show);
  const [label, setLabel] = useState(profile?.label ?? "");
  const [bankName, setBankName] = useState(profile?.bank_name ?? "");
  const [accountName, setAccountName] = useState(profile?.account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(profile?.account_number ?? "");
  const [currency, setCurrency] = useState<CommercialPaymentCurrency>(profile?.currency ?? "LAK");
  const [image, setImage] = useState<File>();
  const [preview, setPreview] = useState("");
  const [removeQr, setRemoveQr] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const photo = image ? preview : removeQr ? "" : profile?.qr_image ?? "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;
    if (![label, bankName, accountName, accountNumber].every((value) => value.trim())) { setValidation(l("paymentProfileRequired")); return; }
    setValidation(null);
    try {
      const result = await savePaymentProfile({ ...(profile ? { profile_uuid: profile.profile_uuid } : {}), label: label.trim(), bank_name: bankName.trim(), account_name: accountName.trim(), account_number: accountNumber.trim(), currency, remove_qr: removeQr, ...(image ? { qr_image: image } : {}) });
      if (!result) return;
      showToast({ title: l("saved"), tone: "success" });
      onSaved(result);
    } catch { /* Keep the private form and the store error visible. */ }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent className="font-lao sm:max-w-xl" showCloseButton={!saving} onKeyDown={(event) => event.stopPropagation()}><DialogHeader><DialogTitle>{l(profile ? "editPaymentProfile" : "addPaymentProfile")}</DialogTitle><DialogDescription>{l("privatePaymentHint")}</DialogDescription></DialogHeader><form className="grid min-w-0 gap-4 [&_input]:min-h-11" onSubmit={submit}>
    {validation || error ? <Alert variant="destructive"><AlertDescription>{validation || error}</AlertDescription></Alert> : null}
    <Field><FieldLabel htmlFor="payment-profile-label">{l("paymentProfileLabel")} *</FieldLabel><Input id="payment-profile-label" value={label} maxLength={120} required disabled={saving} onChange={(event) => setLabel(event.target.value)} /></Field>
    <Field><FieldLabel htmlFor="payment-bank-name">{l("bankName")} *</FieldLabel><Input id="payment-bank-name" value={bankName} maxLength={120} required disabled={saving} onChange={(event) => setBankName(event.target.value)} /></Field>
    <Field><FieldLabel htmlFor="payment-account-name">{l("accountName")} *</FieldLabel><Input id="payment-account-name" value={accountName} maxLength={200} required disabled={saving} onChange={(event) => setAccountName(event.target.value)} /></Field>
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]"><Field><FieldLabel htmlFor="payment-account-number">{l("accountNumber")} *</FieldLabel><Input id="payment-account-number" value={accountNumber} maxLength={100} required disabled={saving} onChange={(event) => setAccountNumber(event.target.value)} /></Field><Field><FieldLabel htmlFor="payment-currency">{l("currency")}</FieldLabel><Select value={currency} onValueChange={(value) => setCurrency(value === "THB" || value === "USD" ? value : "LAK")} disabled={saving}><SelectTrigger id="payment-currency" className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{["LAK", "THB", "USD"].map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select></Field></div>
    <Field><FieldLabel htmlFor="payment-qr-image">{l("paymentQr")}</FieldLabel><Input ref={photoInput} id="payment-qr-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={(event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setValidation(l("photoInvalid")); event.target.value = ""; return; }
      setValidation(null); setImage(file); setRemoveQr(false); setPreview(URL.createObjectURL(file));
    }} /><p className="text-xs text-muted-foreground">{l("paymentQrHint")}</p>{photo ? <div className="flex flex-wrap items-center gap-3"><Image src={photo} alt={l("paymentQr")} width={160} height={160} unoptimized className="size-40 rounded-md border bg-background object-contain p-1" /><Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => setRemoveOpen(true)}>{l("removeQr")}</Button></div> : null}</Field>
    <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>{l("cancel")}</Button><Button type="submit" disabled={saving}>{l(saving ? "saving" : "savePaymentProfile")}</Button></DialogFooter>
  </form></DialogContent><AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}><AlertDialogContent className="font-lao"><AlertDialogHeader><AlertDialogTitle>{l("removeQr")}</AlertDialogTitle><AlertDialogDescription>{l("removeQrConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{l("cancel")}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setImage(undefined); setPreview(""); setRemoveQr(true); setRemoveOpen(false); if (photoInput.current) photoInput.current.value = ""; }}>{l("remove")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></Dialog>;
}
