"use client";

import { useState } from "react";
import { Pencil, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import type { Deportment } from "@/services/deportment";
import type { Position } from "@/services/position";
import { useToastStore } from "@/stores/toast-store";
import { useUserTaxonomyStore, type UserTaxonomyKind } from "@/stores/user-taxonomy-store";
import { deportmentId, deportmentName, positionId, positionName, userValue } from "./user-utils";

function activeRows<T extends Deportment | Position>(kind: UserTaxonomyKind, rows: T[]) {
  const activeKey = kind === "position" ? "position_active" : "deportment_active";
  return rows.filter((row) => Number(userValue(row, activeKey, "1")) === 1);
}

export function UserTaxonomyDialog({
  kind,
  onDeportmentOptionsChange,
  onOpenChange,
  onPositionOptionsChange,
  onSelect,
  open,
  selectedUuid
}: {
  kind: UserTaxonomyKind;
  onDeportmentOptionsChange: (rows: Deportment[]) => void;
  onOpenChange: (open: boolean) => void;
  onPositionOptionsChange: (rows: Position[]) => void;
  onSelect: (uuid: string) => void;
  open: boolean;
  selectedUuid: string;
}) {
  const { i18n, t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const deportments = useUserTaxonomyStore((state) => state.deportments);
  const positions = useUserTaxonomyStore((state) => state.positions);
  const loading = useUserTaxonomyStore((state) => state.loading);
  const saving = useUserTaxonomyStore((state) => state.saving);
  const deletingId = useUserTaxonomyStore((state) => state.deletingId);
  const load = useUserTaxonomyStore((state) => state.load);
  const save = useUserTaxonomyStore((state) => state.save);
  const remove = useUserTaxonomyStore((state) => state.remove);
  const [editingUuid, setEditingUuid] = useState("");
  const [code, setCode] = useState("");
  const [nameLa, setNameLa] = useState("");
  const [nameEng, setNameEng] = useState("");
  const [active, setActive] = useState("1");
  const [deleteUuid, setDeleteUuid] = useState("");
  const optionLabel = t(kind === "position" ? "fields.position" : "fields.deportment");
  const rows = kind === "position" ? positions : deportments;

  function resetForm() {
    setEditingUuid("");
    setCode("");
    setNameLa("");
    setNameEng("");
    setActive("1");
  }

  useResetOnChange(`${kind}:${open}:${i18n.language}`, () => {
    resetForm();
    setDeleteUuid("");
    if (open) {
      void load(kind, i18n.language).catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: optionLabel }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });
    }
  }, { runOnMount: true });

  function syncActiveOptions(preferredUuid = "") {
    const state = useUserTaxonomyStore.getState();
    const options = kind === "position"
      ? activeRows(kind, state.positions)
      : activeRows(kind, state.deportments);

    if (kind === "position") {
      onPositionOptionsChange(options as Position[]);
    } else {
      onDeportmentOptionsChange(options as Deportment[]);
    }

    if (preferredUuid && options.some((row) => (
      kind === "position" ? positionId(row as Position) : deportmentId(row as Deportment)
    ) === preferredUuid)) {
      onSelect(preferredUuid);
    } else if (selectedUuid && !options.some((row) => (
      kind === "position" ? positionId(row as Position) : deportmentId(row as Deportment)
    ) === selectedUuid)) {
      onSelect("");
    }
  }

  function editRow(row: Deportment | Position) {
    setEditingUuid(kind === "position" ? positionId(row as Position) : deportmentId(row as Deportment));
    setCode(userValue(row, kind === "position" ? "position_code" : "deportment_code"));
    setNameLa(userValue(row, kind === "position" ? "position_name_la" : "deportment_name_la"));
    setNameEng(userValue(row, kind === "position" ? "position_name_eng" : "deportment_name_eng"));
    setActive(userValue(row, kind === "position" ? "position_active" : "deportment_active", "1"));
  }

  async function saveRow() {
    const normalizedCode = code.trim();
    const normalizedNameLa = nameLa.trim();
    if (!normalizedCode || !normalizedNameLa) {
      showToast({
        title: t("settings.saveFailed"),
        description: t("settings.userTaxonomyRequired"),
        tone: "error"
      });
      return;
    }

    try {
      const savedUuid = await save(kind, {
        active: Number(active),
        code: normalizedCode,
        nameEng: nameEng.trim(),
        nameLa: normalizedNameLa,
        uuid: editingUuid || undefined
      }, i18n.language);
      syncActiveOptions(savedUuid);
      resetForm();
      showToast({ title: t("settings.saved"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function deleteRow() {
    if (!deleteUuid) return;
    try {
      await remove(kind, deleteUuid, i18n.language);
      if (editingUuid === deleteUuid) resetForm();
      syncActiveOptions();
      setDeleteUuid("");
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving && !deletingId) onOpenChange(nextOpen); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("settings.manageUserTaxonomy", { name: optionLabel })}</DialogTitle>
            <DialogDescription>{t("settings.userTaxonomyDescription", { name: optionLabel })}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            <FieldSet>
              <FieldLegend>{editingUuid ? t("settings.editRecord") : t("settings.newRecord")}</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`${kind}-code`}>{t("fields.code")}</FieldLabel>
                  <Input
                    id={`${kind}-code`}
                    maxLength={50}
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${kind}-name-la`}>{t("fields.nameLa")}</FieldLabel>
                  <Input
                    id={`${kind}-name-la`}
                    maxLength={150}
                    value={nameLa}
                    onChange={(event) => setNameLa(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${kind}-name-eng`}>{t("fields.nameEn")}</FieldLabel>
                  <Input
                    id={`${kind}-name-eng`}
                    maxLength={150}
                    value={nameEng}
                    onChange={(event) => setNameEng(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("common.active")}</FieldLabel>
                  <div className="flex gap-2" role="group" aria-label={t("common.active")}>
                    <Button type="button" variant={active === "1" ? "default" : "outline"} onClick={() => setActive("1")}>
                      {t("settings.userEnable")}
                    </Button>
                    <Button type="button" variant={active === "2" ? "secondary" : "outline"} onClick={() => setActive("2")}>
                      {t("settings.userDisable")}
                    </Button>
                  </div>
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <div className="flex items-center justify-between gap-3">
                <FieldLegend>{optionLabel}</FieldLegend>
                {editingUuid ? (
                  <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                    <RefreshCcw data-icon="inline-start" />
                    {t("actions.new")}
                  </Button>
                ) : null}
              </div>
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {loading ? (
                  <div className="flex min-h-28 items-center justify-center"><Spinner /></div>
                ) : rows.length ? rows.map((row) => {
                  const uuid = kind === "position" ? positionId(row as Position) : deportmentId(row as Deportment);
                  const label = kind === "position" ? positionName(row as Position) : deportmentName(row as Deportment);
                  const rowCode = userValue(row, kind === "position" ? "position_code" : "deportment_code");
                  const rowActive = Number(userValue(row, kind === "position" ? "position_active" : "deportment_active", "1"));
                  return (
                    <div key={uuid} className="flex items-center gap-3 rounded-md border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{label}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{rowCode}</span>
                          <Badge variant={rowActive === 1 ? "secondary" : "outline"}>
                            {t(rowActive === 1 ? "settings.userEnable" : "settings.userDisable")}
                          </Badge>
                        </div>
                      </div>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={t("actions.edit")} onClick={() => editRow(row)}>
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("actions.delete")}
                        disabled={Boolean(deletingId)}
                        onClick={() => setDeleteUuid(uuid)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                }) : (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t("common.noData")}
                  </div>
                )}
              </div>
            </FieldSet>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button>
            <Button type="button" disabled={saving} onClick={() => void saveRow()}>
              {saving ? <Spinner data-icon="inline-start" /> : editingUuid ? <Save data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteUuid)}
        title={`${t("actions.delete")} ${optionLabel}`}
        description={t("settings.deleteConfirm")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={Boolean(deletingId)}
        onConfirm={() => void deleteRow()}
        onOpenChange={(nextOpen) => { if (!nextOpen && !deletingId) setDeleteUuid(""); }}
      />
    </>
  );
}
