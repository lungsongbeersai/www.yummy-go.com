"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { commercialPaymentProfileSnapshot, validCommercialPaymentDraft, type CommercialPaymentDraft } from "@/features/commercial/commercial-payment";
import { CommercialPaymentProfileEditor } from "@/features/commercial/commercial-payment-profile-editor";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import type { CommercialPaymentProfile } from "@/services/commercial";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCommercialStore } from "@/stores/commercial-store";

interface CommercialPaymentFieldsProps {
  value: CommercialPaymentDraft;
  onChange: (value: CommercialPaymentDraft) => void;
  active: boolean;
  disabled: boolean;
  legacyBankDetails?: string;
}

export function CommercialPaymentFields(props: CommercialPaymentFieldsProps) {
  const session = useAuthStore((state) => `${state.user?.uuid ?? ""}:${authStoreUuid(state.user)}:${state.token ?? ""}`);
  // Private dialog drafts cannot survive a login or authenticated-store change.
  return <CommercialPaymentFieldsContent key={session} {...props} />;
}

function CommercialPaymentFieldsContent({ value, onChange, active, disabled, legacyBankDetails }: CommercialPaymentFieldsProps) {
  const l = useCommercialLabels();
  const { paymentProfiles, paymentOwnerUuid, paymentProfilesReady, paymentProfilesLoading, paymentProfilesError, loadPaymentProfiles } = useCommercialStore();
  const ownerKey = useAuthStore((state) => state.user?.uuid ? `${state.user.uuid}:${authStoreUuid(state.user)}` : "");
  const token = useAuthStore((state) => state.token);
  const profiles = ownerKey === paymentOwnerUuid ? paymentProfiles : [];
  const profilesReady = ownerKey === paymentOwnerUuid && paymentProfilesReady;
  const [editing, setEditing] = useState<CommercialPaymentProfile | null | undefined>();
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (active) void loadPaymentProfiles().catch(() => {});
  }, [active, ownerKey, token, loadPaymentProfiles]);

  function saved(profiles: CommercialPaymentProfile[]) {
    // A retained document snapshot changes only through its explicit refresh.
    if (editing) {
      const profile = profiles.find((row) => row.profile_uuid === editing.profile_uuid);
      if (profile) onChange({ ...value, accounts: value.accounts.map((account) => !account.snapshot_uuid && account.profile_uuid === profile.profile_uuid ? commercialPaymentProfileSnapshot(profile) : account) });
    }
    setEditing(undefined);
  }

  return <section className="grid min-w-0 gap-4 rounded-lg border bg-card p-3 sm:p-4" aria-label={l("paymentFooter")}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="font-semibold">{l("paymentFooter")}</h3><p className="mt-1 text-xs text-muted-foreground">{l("privatePaymentHint")}</p></div><Button type="button" data-payment-focus variant="outline" className="min-h-11" disabled={disabled || paymentProfilesLoading || !profilesReady || profiles.length >= 20} onClick={() => setEditing(null)}><Plus />{l("addPaymentProfile")}</Button></div>
    <div className="grid gap-2"><label className="flex min-h-11 cursor-pointer items-center justify-between gap-3"><span>{l("showPaymentAccounts")}</span><Switch checked={value.show_accounts} onCheckedChange={(checked) => onChange({ ...value, show_accounts: checked })} disabled={disabled} /></label><label className="flex min-h-11 cursor-pointer items-center justify-between gap-3"><span>{l("showPaymentQr")}</span><Switch checked={value.show_qr} onCheckedChange={(checked) => onChange({ ...value, show_qr: checked })} disabled={disabled} /></label></div>
    <p className="text-xs text-muted-foreground">{l("paymentSharingHint")}</p>
    {paymentProfilesError ? <Alert variant="destructive"><AlertDescription>{paymentProfilesError}<Button type="button" variant="outline" className="min-h-11" disabled={disabled || paymentProfilesLoading} onClick={() => { void loadPaymentProfiles().catch(() => {}); }}>{l("retry")}</Button></AlertDescription></Alert> : null}
    {paymentProfilesLoading ? <Skeleton className="h-11 w-full" /> : <Field><FieldLabel htmlFor="commercial-payment-profile">{l("choosePaymentProfile")}</FieldLabel><Select value="" disabled={disabled || !profilesReady || !profiles.length || value.accounts.length >= 3} onValueChange={(id) => { const profile = profiles.find((row) => row.profile_uuid === id); if (profile) onChange({ ...value, accounts: [...value.accounts, commercialPaymentProfileSnapshot(profile)] }); }}><SelectTrigger data-payment-focus id="commercial-payment-profile" className="h-11 w-full min-w-0"><SelectValue placeholder={l("choosePaymentProfile")} /></SelectTrigger><SelectContent>{profiles.filter((profile) => !value.accounts.some((account) => account.profile_uuid === profile.profile_uuid)).map((profile) => <SelectItem key={profile.profile_uuid} value={profile.profile_uuid} className="min-h-11"><span className="grid min-w-0 gap-1"><span className="break-words">{profile.account_name} · {profile.currency}</span><span className="break-all text-xs text-muted-foreground tabular-nums">{profile.account_number}</span></span></SelectItem>)}</SelectContent></Select></Field>}
    {!profiles.length && !paymentProfilesLoading && !paymentProfilesError ? <p className="text-sm text-muted-foreground">{l("emptyPaymentProfiles")}</p> : null}
    {value.accounts.map((account, index) => {
      const current = profiles.find((profile) => profile.profile_uuid === account.profile_uuid);
      return <div key={account.snapshot_uuid || account.profile_uuid || index} className="grid min-w-0 gap-2 rounded-md border p-3"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{account.account_name} · {account.currency}</p><p className="break-all text-sm tabular-nums">{account.account_number || l("paymentNumberNotIncluded")}</p>{account.snapshot_uuid ? <p className="text-xs text-muted-foreground">{l("savedPaymentSnapshot")}</p> : null}</div><Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`${l("removePaymentAccount")} ${account.account_name} ${account.currency}`} disabled={disabled} onClick={() => setRemoveIndex(index)}><Trash2 /></Button></div>{account.qr_image ? <Image src={account.qr_image} alt={`${l("paymentQr")} ${account.account_name} ${account.currency}`} width={128} height={128} unoptimized className="size-28 rounded-md border bg-background object-contain p-1" /> : null}{account.snapshot_uuid && current ? <Button type="button" variant="outline" className="min-h-11 whitespace-normal" disabled={disabled} onClick={() => onChange({ ...value, accounts: value.accounts.map((row, position) => position === index ? commercialPaymentProfileSnapshot(current) : row) })}><RefreshCw />{l("refreshPaymentProfile")}</Button> : null}</div>;
    })}
    <p className="text-xs text-muted-foreground">{l("paymentSnapshotHint")}</p>
    {legacyBankDetails?.trim() ? <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{l("legacyBankHint")}</p> : null}
    {(value.show_accounts || value.show_qr) && !validCommercialPaymentDraft(value, legacyBankDetails) ? <Alert><AlertDescription>{l("paymentSelectionRequired")}</AlertDescription></Alert> : null}
    {profiles.length ? <details className="min-w-0 rounded-md border p-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">{l("managePaymentProfiles")}</summary><div className="grid gap-2 pt-3">{profiles.map((profile) => <div key={profile.profile_uuid} className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm">{profile.account_name} · {profile.currency}</p><p className="break-all text-xs text-muted-foreground tabular-nums">{profile.account_number}</p></div><Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={disabled || !profilesReady} onClick={() => setEditing(profile)} aria-label={`${l("editPaymentProfile")} ${profile.account_name} ${profile.currency} ${profile.account_number}`}><Pencil />{l("edit")}</Button></div>)}</div></details> : null}
    {editing !== undefined ? <CommercialPaymentProfileEditor key={editing?.profile_uuid ?? "new"} profile={editing ?? undefined} remaining={Math.max(0, 20 - profiles.length)} onClose={() => setEditing(undefined)} onSaved={saved} /> : null}
    <AlertDialog open={removeIndex !== null} onOpenChange={(open) => { if (!open) setRemoveIndex(null); }}><AlertDialogContent className="font-lao"><AlertDialogHeader><AlertDialogTitle>{l("removePaymentAccount")}</AlertDialogTitle><AlertDialogDescription>{l("removePaymentAccountConfirm")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{l("cancel")}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { onChange({ ...value, accounts: value.accounts.filter((_, index) => index !== removeIndex) }); setRemoveIndex(null); }}>{l("remove")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
