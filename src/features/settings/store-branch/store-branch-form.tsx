"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_CROP, SettingsImageCropPanel, cropImageFile, type CropState } from "@/features/settings/shared/settings-image-crop";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import {
  missingBranchField,
  missingStoreField,
  storeBranchId,
  storeBranchNumber,
  storeBranchValue,
  type StoreBranchKind
} from "./store-branch-utils";
import type { StoreBranchLabels, StoreBranchSettingsRow } from "./store-branch-types";

export function StoreBranchFormDialog({
  activeStoreUuid,
  canEdit,
  editing,
  imageUrl,
  kind,
  labels,
  onCancel,
  onSubmit,
  open,
  saving
}: {
  activeStoreUuid: string;
  canEdit: boolean;
  editing: StoreBranchSettingsRow | null;
  imageUrl: (row: StoreBranchSettingsRow, rowKind: StoreBranchKind) => string;
  kind: StoreBranchKind;
  labels: StoreBranchLabels;
  onCancel: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) onCancel();
      }}
    >
      <SettingsDialogContent className="sm:max-w-5xl" showCloseButton={!saving}>
        <EntityForm
          activeStoreUuid={activeStoreUuid}
          canEdit={canEdit}
          editing={editing}
          imageUrl={imageUrl}
          kind={kind}
          labels={labels}
          saving={saving}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
        {saving ? <FormSavingOverlay labels={labels} onCancel={onCancel} /> : null}
      </SettingsDialogContent>
    </Dialog>
  );
}

function FormSavingOverlay({ labels, onCancel }: { labels: StoreBranchLabels; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-background/90 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-xl">
        <div className="grid size-10 place-items-center rounded-lg bg-muted text-primary">
          <Spinner />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-base font-black">{labels.savingTitle}</p>
          <p className="text-sm leading-6 text-muted-foreground">{labels.savingHint}</p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel}>
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}

function FormSelectField({
  disabled,
  id,
  label,
  name,
  onValueChange,
  options,
  value
}: {
  disabled?: boolean;
  id: string;
  label: string;
  name: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input name={name} type="hidden" value={value} readOnly />
      <Select disabled={disabled} value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function EntityForm({
  activeStoreUuid,
  canEdit,
  editing,
  imageUrl,
  kind,
  labels,
  onCancel,
  onSubmit,
  saving
}: {
  activeStoreUuid: string;
  canEdit: boolean;
  editing: StoreBranchSettingsRow | null;
  imageUrl: (row: StoreBranchSettingsRow, rowKind: StoreBranchKind) => string;
  kind: StoreBranchKind;
  labels: StoreBranchLabels;
  onCancel: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  saving: boolean;
}) {
  const recordKey = `${kind}-${editing ? storeBranchId(editing, kind) : "new"}`;
  const imageFieldName = kind === "store" ? "store_logo" : "branch_qr";
  const disabled = !canEdit || saving;
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [storeNameLa, setStoreNameLa] = useState("");
  const [storeNameEng, setStoreNameEng] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchTel, setBranchTel] = useState("");
  const [branchEmail, setBranchEmail] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [storeStatus, setStoreStatus] = useState("2");
  const [storeActive, setStoreActive] = useState("1");
  const [vatStatus, setVatStatus] = useState("2");
  const [vatPercent, setVatPercent] = useState("0");
  const [chargeStatus, setChargeStatus] = useState("2");
  const [chargePercent, setChargePercent] = useState("0");
  const formHint = kind === "store" ? labels.storeHint : labels.branchHint;
  const existingSrc = editing ? imageUrl(editing, kind) : "";
  const canSubmit =
    !disabled &&
    (kind === "store"
      ? !missingStoreField({ email: storeEmail, nameLa: storeNameLa })
      : !missingBranchField({ name: branchName, storeUuid: activeStoreUuid }));

  useEffect(() => {
    setSelectedImage(null);
    setCrop(DEFAULT_CROP);
    setStoreNameLa(storeBranchValue(editing, "store_name_la", storeBranchValue(editing, "store_name")));
    setStoreNameEng(storeBranchValue(editing, "store_name_eng"));
    setStoreEmail(storeBranchValue(editing, "store_email"));
    setBranchName(storeBranchValue(editing, "branch_name"));
    setBranchTel(storeBranchValue(editing, "branch_tel"));
    setBranchEmail(storeBranchValue(editing, "branch_email"));
    setBranchAddress(storeBranchValue(editing, "branch_address"));
    setStoreStatus(String(storeBranchNumber(editing, "store_status", 2)));
    setStoreActive(String(storeBranchNumber(editing, "store_active", 1)));
    setVatStatus(String(storeBranchNumber(editing, "vat_status", 2)));
    setVatPercent(String(storeBranchNumber(editing, "vat_name", 0)));
    setChargeStatus(String(storeBranchNumber(editing, "charge_status", 2)));
    setChargePercent(String(storeBranchNumber(editing, "charge_name", 0)));
  }, [editing, recordKey]);

  async function handleSubmit(formData: FormData) {
    if (selectedImage) {
      const croppedFile = await cropImageFile(selectedImage, crop, labels.imageLoadFailed);
      formData.set(imageFieldName, croppedFile);
    }
    await onSubmit(formData);
  }

  return (
    <SettingsDialogForm key={recordKey} action={handleSubmit} className="sm:max-h-[calc(100dvh-2rem)]">
      <SettingsDialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
            {editing ? <CheckCircle2 aria-hidden /> : <Plus aria-hidden />}
          </span>
          {kind === "store" ? labels.storeInfo : labels.branchInfo}
        </DialogTitle>
        <DialogDescription>{formHint}</DialogDescription>
      </SettingsDialogHeader>

      <SettingsDialogBody className="p-0 sm:p-0">
        <div className="grid min-h-full gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:p-5">
          <SettingsImageCropPanel
            crop={crop}
            className="rounded-lg border border-border lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto"
            description={labels.cropHint}
            disabled={!canEdit}
            emptyLabel={kind === "store" ? labels.store : labels.branch}
            existingSrc={existingSrc}
            fileSupportText={labels.imageSupport}
            fieldId={`${recordKey}-${imageFieldName}`}
            horizontalLabel={labels.horizontal}
            previewMaxClassName="max-w-[10rem] sm:max-w-56 lg:max-w-none"
            removeLabel={labels.cancelImage}
            saving={saving}
            selectedFile={selectedImage}
            sideBorderAt="lg"
            title={labels.cropImage}
            uploadLabel={labels.uploadImage}
            verticalLabel={labels.vertical}
            zoomLabel={labels.zoom}
            onCropChange={setCrop}
            onFileChange={setSelectedImage}
          />

          <FieldGroup className="min-w-0 gap-4">
            <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
              <Field>
                <FieldLegend>{kind === "store" ? labels.storeDetails : labels.branchDetails}</FieldLegend>
                <FieldDescription>{formHint}</FieldDescription>
              </Field>
              {kind === "store" ? (
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-name-la`}>{labels.nameLa}</FieldLabel>
                    <Input
                      id={`${recordKey}-name-la`}
                      name="store_name_la"
                      autoComplete="organization"
                      disabled={disabled}
                      required
                      value={storeNameLa}
                      onChange={(event) => setStoreNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-name-en`}>{labels.nameEn}</FieldLabel>
                    <Input
                      id={`${recordKey}-name-en`}
                      name="store_name_eng"
                      autoComplete="organization"
                      disabled={disabled}
                      value={storeNameEng}
                      onChange={(event) => setStoreNameEng(event.target.value)}
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`${recordKey}-email`}>{labels.email}</FieldLabel>
                    <Input
                      id={`${recordKey}-email`}
                      name="store_email"
                      autoComplete="email"
                      disabled={disabled}
                      placeholder={labels.emailPlaceholder}
                      required
                      spellCheck={false}
                      translate="no"
                      type="email"
                      value={storeEmail}
                      onChange={(event) => setStoreEmail(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              ) : (
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`${recordKey}-branch-name`}>{labels.name}</FieldLabel>
                    <Input
                      id={`${recordKey}-branch-name`}
                      name="branch_name"
                      autoComplete="organization"
                      disabled={disabled}
                      required
                      value={branchName}
                      onChange={(event) => setBranchName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-phone`}>{labels.phone}</FieldLabel>
                    <Input
                      id={`${recordKey}-phone`}
                      name="branch_tel"
                      autoComplete="tel"
                      disabled={disabled}
                      inputMode="tel"
                      spellCheck={false}
                      translate="no"
                      type="tel"
                      value={branchTel}
                      onChange={(event) => setBranchTel(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-branch-email`}>{labels.email}</FieldLabel>
                    <Input
                      id={`${recordKey}-branch-email`}
                      name="branch_email"
                      autoComplete="email"
                      disabled={disabled}
                      placeholder={labels.emailPlaceholder}
                      spellCheck={false}
                      translate="no"
                      type="email"
                      value={branchEmail}
                      onChange={(event) => setBranchEmail(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              )}
            </FieldSet>

            {kind === "store" ? (
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{labels.contactDetails}</FieldLegend>
                  <FieldDescription>{labels.contactHint}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <FormSelectField
                    disabled={disabled}
                    id={`${recordKey}-store-status`}
                    label={labels.type}
                    name="store_status"
                    value={storeStatus}
                    onValueChange={setStoreStatus}
                    options={[
                      { label: labels.plc, value: "1" },
                      { label: labels.general, value: "2" }
                    ]}
                  />
                  <FormSelectField
                    disabled={disabled}
                    id={`${recordKey}-store-active`}
                    label={labels.active}
                    name="store_active"
                    value={storeActive}
                    onValueChange={setStoreActive}
                    options={[
                      { label: labels.open, value: "1" },
                      { label: labels.closed, value: "2" }
                    ]}
                  />
                </FieldGroup>
              </FieldSet>
            ) : (
              <>
                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <Field>
                    <FieldLegend>{labels.contactDetails}</FieldLegend>
                    <FieldDescription>{labels.contactHint}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-address`}>{labels.address}</FieldLabel>
                    <Textarea
                      id={`${recordKey}-address`}
                      name="branch_address"
                      autoComplete="street-address"
                      disabled={disabled}
                      value={branchAddress}
                      onChange={(event) => setBranchAddress(event.target.value)}
                    />
                  </Field>
                </FieldSet>

                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <Field>
                    <FieldLegend>{labels.taxBilling}</FieldLegend>
                    <FieldDescription>{labels.taxBillingHint}</FieldDescription>
                  </Field>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <FormSelectField
                      disabled={disabled}
                      id={`${recordKey}-vat-status`}
                      label={labels.vat}
                      name="vat_status"
                      value={vatStatus}
                      onValueChange={setVatStatus}
                      options={[
                        { label: labels.active, value: "1" },
                        { label: labels.inactive, value: "2" }
                      ]}
                    />
                    <Field>
                      <FieldLabel htmlFor={`${recordKey}-vat-percent`}>{labels.vatPercent}</FieldLabel>
                      <FormattedNumberInput
                        decimal
                        id={`${recordKey}-vat-percent`}
                        name="vat_name"
                        autoComplete="off"
                        disabled={disabled}
                        min="0"
                        step="0.01"
                        translate="no"
                        value={vatPercent}
                        onValueChange={setVatPercent}
                      />
                    </Field>
                    <FormSelectField
                      disabled={disabled}
                      id={`${recordKey}-charge-status`}
                      label={labels.charge}
                      name="charge_status"
                      value={chargeStatus}
                      onValueChange={setChargeStatus}
                      options={[
                        { label: labels.active, value: "1" },
                        { label: labels.inactive, value: "2" }
                      ]}
                    />
                    <Field>
                      <FieldLabel htmlFor={`${recordKey}-charge-percent`}>{labels.chargePercent}</FieldLabel>
                      <FormattedNumberInput
                        decimal
                        id={`${recordKey}-charge-percent`}
                        name="charge_name"
                        autoComplete="off"
                        disabled={disabled}
                        min="0"
                        step="0.01"
                        translate="no"
                        value={chargePercent}
                        onValueChange={setChargePercent}
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </>
            )}
          </FieldGroup>
        </div>
      </SettingsDialogBody>

      <input name={kind === "store" ? "store_uuid" : "branch_uuid"} type="hidden" value={storeBranchId(editing, kind)} readOnly />
      {kind === "branch" ? <input name="store_uuid_fk" type="hidden" value={activeStoreUuid} readOnly /> : null}
      <SettingsDialogFooter>
        <Button disabled={saving} type="button" variant="outline" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button disabled={!canSubmit} type="submit">
          {saving ? <Spinner data-icon="inline-start" /> : null}
          {saving ? labels.savingTitle : labels.save}
        </Button>
      </SettingsDialogFooter>
    </SettingsDialogForm>
  );
}
