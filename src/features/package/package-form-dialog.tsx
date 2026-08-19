"use client";

import { type FormEvent, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
} from "@/features/settings/shared/settings-shell";
import { validatePackageDraft } from "@/features/package/package-ui-utils";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import type { Language } from "@/lib/language";
import type {
  PackageDetail,
  PackageItem,
  PackagePlanGroup,
  SavePackageInput,
} from "@/services/package";

interface PackageDetailDraft {
  key: string;
  id: string;
  nameLa: string;
  nameEn: string;
  status: number;
}

interface PackageDraft {
  id: string;
  planId: string;
  nameLa: string;
  nameEn: string;
  price: string;
  status: number;
  details: PackageDetailDraft[];
}

interface PackageFormDialogProps {
  editing: PackageItem | null;
  language: Language;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: SavePackageInput) => Promise<void>;
  open: boolean;
  planGroups: PackagePlanGroup[];
  saving: boolean;
  selectedPlanId: string;
}

function createDetailDraft(
  detail?: PackageDetail,
): PackageDetailDraft {
  return {
    key: crypto.randomUUID(),
    id: detail?.id ?? "",
    nameLa: detail?.nameLa ?? "",
    nameEn: detail?.nameEn ?? "",
    status: detail?.status === 2 ? 2 : 1,
  };
}

function createPackageDraft(
  editing: PackageItem | null,
  selectedPlanId: string,
): PackageDraft {
  if (editing) {
    return {
      id: editing.id,
      planId: editing.planId,
      nameLa: editing.nameLa,
      nameEn: editing.nameEn,
      price: String(editing.price),
      status: editing.status === 2 ? 2 : 1,
      details: editing.details.map((detail) => createDetailDraft(detail)),
    };
  }

  return {
    id: "",
    planId: selectedPlanId,
    nameLa: "",
    nameEn: "",
    price: "",
    status: 1,
    details: [createDetailDraft()],
  };
}

function draftSignature(draft: PackageDraft): string {
  return JSON.stringify({
    id: draft.id,
    planId: draft.planId,
    nameLa: draft.nameLa,
    nameEn: draft.nameEn,
    price: draft.price,
    status: draft.status,
    details: draft.details.map((detail) => ({
      id: detail.id,
      nameLa: detail.nameLa,
      nameEn: detail.nameEn,
      status: detail.status,
    })),
  });
}

export function PackageFormDialog({
  editing,
  language,
  onOpenChange,
  onSubmit,
  open,
  planGroups,
  saving,
  selectedPlanId,
}: PackageFormDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PackageDraft>(() =>
    createPackageDraft(editing, selectedPlanId),
  );
  const [initialDraft, setInitialDraft] = useState<PackageDraft>(() =>
    createPackageDraft(editing, selectedPlanId),
  );
  const [validationError, setValidationError] = useState<
    ReturnType<typeof validatePackageDraft>
  >(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useResetOnDeps([open, editing, selectedPlanId], () => {
    const nextDraft = createPackageDraft(editing, selectedPlanId);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setValidationError(null);
    setDiscardOpen(false);
    setSubmitting(false);
  });

  const dirty = draftSignature(draft) !== draftSignature(initialDraft);
  const hasPlans = planGroups.some((group) => group.plans.length > 0);
  const planExists = planGroups.some((group) =>
    group.plans.some((plan) => plan.id === draft.planId),
  );
  const planInvalid = validationError === "plan";
  const nameLaInvalid = validationError === "nameLa";
  const nameEnInvalid = validationError === "nameEn";
  const priceInvalid = validationError === "price";
  const detailsInvalid = validationError === "details";
  const busy = saving || submitting;

  function updateDraft(nextDraft: PackageDraft) {
    setDraft(nextDraft);
    setValidationError(null);
  }

  function requestClose() {
    if (busy) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  function updateDetail(
    key: string,
    updates: Partial<
      Pick<PackageDetailDraft, "nameLa" | "nameEn" | "status">
    >,
  ) {
    updateDraft({
      ...draft,
      details: draft.details.map((detail) =>
        detail.key === key ? { ...detail, ...updates } : detail,
      ),
    });
  }

  function moveDetail(index: number, offset: -1 | 1) {
    const nextIndex = index + offset;
    if (
      index < 0 ||
      nextIndex < 0 ||
      nextIndex >= draft.details.length
    ) {
      return;
    }

    const details = [...draft.details];
    const moved = details.splice(index, 1)[0];
    if (!moved) return;
    details.splice(nextIndex, 0, moved);
    updateDraft({ ...draft, details });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const nextValidationError = validatePackageDraft(draft);
    if (nextValidationError || !planExists) {
      setValidationError(nextValidationError ?? "plan");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        id: draft.id || undefined,
        planId: draft.planId,
        nameLa: draft.nameLa.trim(),
        nameEn: draft.nameEn.trim(),
        price: Number(draft.price),
        status: draft.status,
        language,
        details: draft.details.map((detail) => ({
          id: detail.id,
          nameLa: detail.nameLa.trim(),
          nameEn: detail.nameEn.trim(),
          status: detail.status,
        })),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <SettingsDialogContent
          className="sm:max-w-4xl"
          showCloseButton={!busy}
        >
          <SettingsDialogForm aria-busy={busy} onSubmit={handleSubmit}>
            <SettingsDialogHeader>
              <DialogTitle>
                {editing
                  ? t("packageManagement.editPackage")
                  : t("packageManagement.addPackage")}
              </DialogTitle>
              <DialogDescription>
                {t("packageManagement.packageDialogDescription")}
              </DialogDescription>
            </SettingsDialogHeader>

            <SettingsDialogBody className="overscroll-contain">
              <FieldGroup>
                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <FieldLegend className="mb-0">
                    {t("packageManagement.package")}
                  </FieldLegend>

                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field
                      className="sm:col-span-2"
                      data-invalid={planInvalid}
                    >
                      <FieldLabel htmlFor="package-form-plan">
                        {t("packageManagement.plan")}
                      </FieldLabel>
                      <Select
                        disabled={busy || !hasPlans}
                        required
                        value={draft.planId}
                        onValueChange={(planId) =>
                          updateDraft({ ...draft, planId })
                        }
                      >
                        <SelectTrigger
                          id="package-form-plan"
                          className="h-11! w-full sm:h-9!"
                          aria-describedby={
                            planInvalid ? "package-form-plan-error" : undefined
                          }
                          aria-invalid={planInvalid}
                        >
                          <SelectValue
                            placeholder={t("packageManagement.plan")}
                          />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {planGroups.map((group) => (
                            <SelectGroup key={group.billingCycleId}>
                              <SelectLabel>
                                {group.billingCycleName}
                              </SelectLabel>
                              {group.plans.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.methodName}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      {planInvalid ? (
                        <FieldError id="package-form-plan-error">
                          {t("packageManagement.planRequired")}
                        </FieldError>
                      ) : null}
                    </Field>

                    <Field data-invalid={nameLaInvalid}>
                      <FieldLabel htmlFor="package-form-name-la">
                        {t("packageManagement.packageNameLa")}
                      </FieldLabel>
                      <Input
                        id="package-form-name-la"
                        className="h-11 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 sm:h-10"
                        autoComplete="off"
                        aria-describedby={
                          nameLaInvalid
                            ? "package-form-name-la-error"
                            : undefined
                        }
                        aria-invalid={nameLaInvalid}
                        disabled={busy}
                        value={draft.nameLa}
                        onChange={(event) =>
                          updateDraft({
                            ...draft,
                            nameLa: event.target.value,
                          })
                        }
                      />
                      {nameLaInvalid ? (
                        <FieldError id="package-form-name-la-error">
                          {t("packageManagement.packageNameLaRequired")}
                        </FieldError>
                      ) : null}
                    </Field>

                    <Field data-invalid={nameEnInvalid}>
                      <FieldLabel htmlFor="package-form-name-en">
                        {t("packageManagement.packageNameEn")}
                      </FieldLabel>
                      <Input
                        id="package-form-name-en"
                        className="h-11 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 sm:h-10"
                        autoComplete="off"
                        aria-describedby={
                          nameEnInvalid
                            ? "package-form-name-en-error"
                            : undefined
                        }
                        aria-invalid={nameEnInvalid}
                        disabled={busy}
                        value={draft.nameEn}
                        onChange={(event) =>
                          updateDraft({
                            ...draft,
                            nameEn: event.target.value,
                          })
                        }
                      />
                      {nameEnInvalid ? (
                        <FieldError id="package-form-name-en-error">
                          {t("packageManagement.packageNameEnRequired")}
                        </FieldError>
                      ) : null}
                    </Field>

                    <Field data-invalid={priceInvalid}>
                      <FieldLabel htmlFor="package-form-price">
                        {t("packageManagement.price")}
                      </FieldLabel>
                      <FormattedNumberInput
                        id="package-form-price"
                        className="h-11 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 sm:h-10"
                        aria-describedby={
                          priceInvalid
                            ? "package-form-price-error"
                            : undefined
                        }
                        aria-invalid={priceInvalid}
                        disabled={busy}
                        min={0}
                        value={draft.price}
                        onValueChange={(price) =>
                          updateDraft({ ...draft, price })
                        }
                      />
                      {priceInvalid ? (
                        <FieldError id="package-form-price-error">
                          {t("packageManagement.priceInvalid")}
                        </FieldError>
                      ) : null}
                    </Field>

                    <Field
                      data-disabled={busy}
                      orientation="horizontal"
                      className="min-h-11 rounded-md border border-border bg-muted/20 p-3"
                    >
                      <FieldLabel
                        htmlFor="package-form-status"
                        className="self-stretch cursor-pointer items-center"
                      >
                        {t("packageManagement.statusLabel")}
                      </FieldLabel>
                      <span className="text-sm font-medium text-muted-foreground">
                        {draft.status === 1
                          ? t("packageManagement.active")
                          : t("packageManagement.inactive")}
                      </span>
                      <Switch
                        id="package-form-status"
                        checked={draft.status === 1}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          updateDraft({
                            ...draft,
                            status: checked ? 1 : 2,
                          })
                        }
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSet
                  className="gap-4 rounded-lg border border-border bg-card p-4 data-[invalid=true]:border-destructive"
                  data-invalid={detailsInvalid}
                  aria-describedby={
                    detailsInvalid ? "package-form-details-error" : undefined
                  }
                  aria-invalid={detailsInvalid}
                >
                  <FieldLegend className="mb-0">
                    {t("packageManagement.details")}
                  </FieldLegend>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FieldDescription>
                      {t("packageManagement.packageDetailsDescription")}
                    </FieldDescription>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 shrink-0 sm:h-9"
                      disabled={busy}
                      onClick={() =>
                        updateDraft({
                          ...draft,
                          details: [
                            ...draft.details,
                            createDetailDraft(),
                          ],
                        })
                      }
                    >
                      <Plus data-icon="inline-start" />
                      {t("packageManagement.addDetail")}
                    </Button>
                  </div>

                  {detailsInvalid ? (
                    <FieldError id="package-form-details-error">
                      {t("packageManagement.detailsRequired")}
                    </FieldError>
                  ) : null}

                  <FieldGroup className="gap-3">
                    {draft.details.map((detail, index) => (
                      <PackageDetailDraftRow
                        key={detail.key}
                        detail={detail}
                        index={index}
                        saving={busy}
                        total={draft.details.length}
                        validationError={validationError}
                        onChange={(updates) =>
                          updateDetail(detail.key, updates)
                        }
                        onMove={(offset) => moveDetail(index, offset)}
                        onRemove={() =>
                          updateDraft({
                            ...draft,
                            details: draft.details.filter(
                              (item) => item.key !== detail.key,
                            ),
                          })
                        }
                      />
                    ))}
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
            </SettingsDialogBody>

            <SettingsDialogFooter className="pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-10"
                disabled={busy}
                onClick={requestClose}
              >
                {t("actions.cancel")}
              </Button>
              <Button
                type="submit"
                className="h-11 sm:h-10"
                disabled={busy || !hasPlans}
              >
                {busy ? <Spinner data-icon="inline-start" /> : null}
                {busy
                  ? t("common.processing")
                  : t("packageManagement.save")}
              </Button>
            </SettingsDialogFooter>
          </SettingsDialogForm>
        </SettingsDialogContent>
      </Dialog>

      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("packageManagement.discardAction")}
        description={t("packageManagement.discardDescription")}
        open={discardOpen}
        title={t("packageManagement.discardTitle")}
        onConfirm={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
        onOpenChange={setDiscardOpen}
      />
    </>
  );
}

function PackageDetailDraftRow({
  detail,
  index,
  saving,
  total,
  validationError,
  onChange,
  onMove,
  onRemove,
}: {
  detail: PackageDetailDraft;
  index: number;
  saving: boolean;
  total: number;
  validationError: ReturnType<typeof validatePackageDraft>;
  onChange: (
    updates: Partial<
      Pick<PackageDetailDraft, "nameLa" | "nameEn" | "status">
    >,
  ) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const nameLaInvalid =
    validationError === "detailNameLa" && !detail.nameLa.trim();
  const nameEnInvalid =
    validationError === "detailNameEn" && !detail.nameEn.trim();
  const rowLabel = `${t("packageManagement.packageDetail")} ${index + 1}`;
  const nameLaId = `package-detail-${detail.key}-name-la`;
  const nameEnId = `package-detail-${detail.key}-name-en`;
  const statusId = `package-detail-${detail.key}-status`;

  return (
    <FieldSet className="gap-3 rounded-lg border border-border bg-muted/15 p-3">
      <FieldLegend className="mb-0 text-sm font-bold">
        {rowLabel}
      </FieldLegend>

      <div className="flex flex-wrap items-center justify-end gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-11"
          aria-label={`${t("packageManagement.moveUp")} ${rowLabel}`}
          title={`${t("packageManagement.moveUp")} ${rowLabel}`}
          disabled={saving || index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-11"
          aria-label={`${t("packageManagement.moveDown")} ${rowLabel}`}
          title={`${t("packageManagement.moveDown")} ${rowLabel}`}
          disabled={saving || index === total - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-11 text-destructive"
          aria-label={`${t("packageManagement.removeDetail")} ${rowLabel}`}
          title={`${t("packageManagement.removeDetail")} ${rowLabel}`}
          disabled={saving}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={nameLaInvalid}>
          <FieldLabel htmlFor={nameLaId}>{t("fields.nameLa")}</FieldLabel>
          <Input
            id={nameLaId}
            className="h-11 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 sm:h-10"
            autoComplete="off"
            aria-describedby={
              nameLaInvalid ? `${nameLaId}-error` : undefined
            }
            aria-invalid={nameLaInvalid}
            disabled={saving}
            value={detail.nameLa}
            onChange={(event) => onChange({ nameLa: event.target.value })}
          />
          {nameLaInvalid ? (
            <FieldError id={`${nameLaId}-error`}>
              {t("packageManagement.detailNameLaRequired")}
            </FieldError>
          ) : null}
        </Field>

        <Field data-invalid={nameEnInvalid}>
          <FieldLabel htmlFor={nameEnId}>{t("fields.nameEn")}</FieldLabel>
          <Input
            id={nameEnId}
            className="h-11 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 sm:h-10"
            autoComplete="off"
            aria-describedby={
              nameEnInvalid ? `${nameEnId}-error` : undefined
            }
            aria-invalid={nameEnInvalid}
            disabled={saving}
            value={detail.nameEn}
            onChange={(event) => onChange({ nameEn: event.target.value })}
          />
          {nameEnInvalid ? (
            <FieldError id={`${nameEnId}-error`}>
              {t("packageManagement.detailNameEnRequired")}
            </FieldError>
          ) : null}
        </Field>
      </FieldGroup>

      <Field
        data-disabled={saving}
        orientation="horizontal"
        className="min-h-11 rounded-md border border-border bg-background p-3"
      >
        <FieldLabel
          htmlFor={statusId}
          className="self-stretch cursor-pointer items-center"
        >
          {t("packageManagement.statusLabel")}
        </FieldLabel>
        <span className="text-sm font-medium text-muted-foreground">
          {detail.status === 1
            ? t("packageManagement.active")
            : t("packageManagement.inactive")}
        </span>
        <Switch
          id={statusId}
          checked={detail.status === 1}
          disabled={saving}
          onCheckedChange={(checked) =>
            onChange({ status: checked ? 1 : 2 })
          }
        />
      </Field>
    </FieldSet>
  );
}
