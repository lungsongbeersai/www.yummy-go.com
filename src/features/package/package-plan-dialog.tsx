"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
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
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
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
import {
  availableMethods,
  validatePlanDraft,
} from "@/features/package/package-ui-utils";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import type {
  BillingCycle,
  CreatePackagePlanInput,
  PackageMethod,
  PackagePlanGroup,
} from "@/services/package";

interface PlanDraft {
  billingCycleId: string;
  methodId: string;
  status: number;
}

interface PackagePlanDialogProps {
  billingCycles: BillingCycle[];
  methods: PackageMethod[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreatePackagePlanInput) => Promise<void>;
  open: boolean;
  planGroups: PackagePlanGroup[];
  saving: boolean;
  selectedCycleId: string;
}

function createPlanDraft(selectedCycleId: string): PlanDraft {
  return {
    billingCycleId: selectedCycleId,
    methodId: "",
    status: 1,
  };
}

export function PackagePlanDialog({
  billingCycles,
  methods,
  onOpenChange,
  onSubmit,
  open,
  planGroups,
  saving,
  selectedCycleId,
}: PackagePlanDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PlanDraft>(() =>
    createPlanDraft(selectedCycleId),
  );
  const [initialDraft, setInitialDraft] = useState<PlanDraft>(() =>
    createPlanDraft(selectedCycleId),
  );
  const [validationError, setValidationError] = useState<
    ReturnType<typeof validatePlanDraft>
  >(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useResetOnDeps([open, selectedCycleId], () => {
    const nextDraft = createPlanDraft(selectedCycleId);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setValidationError(null);
    setDiscardOpen(false);
    setSubmitting(false);
  });

  const selectedGroup =
    planGroups.find(
      (group) => group.billingCycleId === draft.billingCycleId,
    ) ?? null;
  const selectableMethods = useMemo(
    () => availableMethods(methods, selectedGroup),
    [methods, selectedGroup],
  );
  const methodAvailable = selectableMethods.some(
    (method) => method.id === draft.methodId,
  );
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const billingCycleInvalid = validationError === "billingCycle";
  const methodInvalid = validationError === "method";
  const busy = saving || submitting;
  const saveDisabled =
    busy ||
    !draft.billingCycleId ||
    !selectableMethods.length ||
    !methodAvailable;

  function updateDraft(nextDraft: PlanDraft) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const nextValidationError = validatePlanDraft(draft);
    if (
      nextValidationError ||
      !selectableMethods.some((method) => method.id === draft.methodId)
    ) {
      setValidationError(nextValidationError ?? "method");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        billingCycleId: draft.billingCycleId,
        methodId: draft.methodId,
        status: draft.status,
        sortOrder: (selectedGroup?.plans.length ?? 0) + 1,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <SettingsDialogContent
          className="sm:max-w-2xl"
          showCloseButton={!busy}
        >
          <SettingsDialogForm aria-busy={busy} onSubmit={handleSubmit}>
            <SettingsDialogHeader>
              <DialogTitle>{t("packageManagement.addPlan")}</DialogTitle>
              <DialogDescription>
                {t("packageManagement.planDialogDescription")}
              </DialogDescription>
            </SettingsDialogHeader>

            <SettingsDialogBody className="overscroll-contain">
              <FieldGroup>
                <Field data-invalid={billingCycleInvalid}>
                  <FieldLabel htmlFor="package-plan-billing-cycle">
                    {t("packageManagement.billingCycle")}
                  </FieldLabel>
                  <Select
                    disabled={busy}
                    required
                    value={draft.billingCycleId}
                    onValueChange={(billingCycleId) =>
                      updateDraft({
                        ...draft,
                        billingCycleId,
                        methodId: "",
                      })
                    }
                  >
                    <SelectTrigger
                      id="package-plan-billing-cycle"
                      className="h-11! w-full sm:h-9!"
                      aria-describedby={
                        billingCycleInvalid
                          ? "package-plan-billing-cycle-error"
                          : undefined
                      }
                      aria-invalid={billingCycleInvalid}
                    >
                      <SelectValue
                        placeholder={t("packageManagement.billingCycle")}
                      />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {billingCycles.map((cycle) => (
                          <SelectItem key={cycle.id} value={cycle.id}>
                            {cycle.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {billingCycleInvalid ? (
                    <FieldError id="package-plan-billing-cycle-error">
                      {t("packageManagement.billingCycleRequired")}
                    </FieldError>
                  ) : null}
                </Field>

                <Field data-invalid={methodInvalid}>
                  <FieldLabel htmlFor="package-plan-method">
                    {t("packageManagement.plan")}
                  </FieldLabel>
                  <Select
                    disabled={busy || !selectableMethods.length}
                    required
                    value={draft.methodId}
                    onValueChange={(methodId) =>
                      updateDraft({ ...draft, methodId })
                    }
                  >
                    <SelectTrigger
                      id="package-plan-method"
                      className="h-11! w-full sm:h-9!"
                      aria-describedby={
                        methodInvalid
                          ? "package-plan-method-error"
                          : !selectableMethods.length
                            ? "package-plan-method-description"
                            : undefined
                      }
                      aria-invalid={methodInvalid}
                    >
                      <SelectValue placeholder={t("packageManagement.plan")} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {selectableMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {methodInvalid ? (
                    <FieldError id="package-plan-method-error">
                      {t("packageManagement.planRequired")}
                    </FieldError>
                  ) : !selectableMethods.length ? (
                    <FieldDescription id="package-plan-method-description">
                      {t("packageManagement.noMethodsAvailable")}
                    </FieldDescription>
                  ) : null}
                </Field>

                <Field
                  data-disabled={busy}
                  orientation="horizontal"
                  className="min-h-11 rounded-md border border-border bg-muted/20 p-3"
                >
                  <FieldLabel
                    htmlFor="package-plan-status"
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
                    id="package-plan-status"
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
                disabled={saveDisabled}
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
