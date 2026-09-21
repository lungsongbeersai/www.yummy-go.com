"use client";

import { Pencil, Plus, RefreshCcw, Save, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  TASTE_MAX_SELECT_OPTIONS,
  entityLabel,
  productTasteName,
  tasteUuid,
} from "./product-form-utils";
import { ProductFormSectionHeader } from "./product-form-section-header";
import type { ProductFormWorkflow } from "./use-product-form-workflow";

export function ProductFormTastesSection({ form }: { form: ProductFormWorkflow }) {
  const {
    t,
    language,
    statusSortFk,
    storeUuid,
    tasteSaving,
    prodTasteMaxSelect,
    setProdTasteMaxSelect,
    selectedTasteBadges,
    selectedTasteUuids,
    tasteOptions,
    filteredTasteOptions,
    tasteSearch,
    setTasteSearch,
    toggleTaste,
    tasteDialogOpen,
    setTasteDialogOpen,
    resetNewTasteForm,
    editingTasteUuid,
    newTasteNameLa,
    setNewTasteNameLa,
    newTasteNameEng,
    setNewTasteNameEng,
    saveTasteFromDialog,
    editTaste,
    deletingTasteUuid,
    setDeletingTasteUuid,
    deleteTasteFromDialog,
  } = form;
  const enabled = Number(prodTasteMaxSelect) > 0;
  const isSet = statusSortFk === "2";
  const optionName = t(isSet ? "product.sauce" : "product.taste");
  const sectionTitle = t(isSet ? "product.sauces" : "product.sections.tastes");
  const sectionHint = t(
    isSet ? "product.sections.saucesHint" : "product.sections.tastesHint",
  );

  return (
    <>
      {!isSet ? (
        <Card>
          <ProductFormSectionHeader
          number="3"
          title={sectionTitle}
          hint={sectionHint}
          action={
            <Button
              className="max-sm:w-full"
              type="button"
              size="sm"
              variant="outline"
              disabled={!storeUuid || tasteSaving}
              onClick={() => {
                if (!enabled) setProdTasteMaxSelect("1");
                setTasteDialogOpen(true);
              }}
            >
              <Plus data-icon="inline-start" />
              {t("actions.add")} {optionName}
            </Button>
          }
        />
          <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="prod-taste-max-select">
              {t(isSet ? "product.sauceMode" : "product.tasteMode")}
            </FieldLabel>
            <Select value={prodTasteMaxSelect} onValueChange={setProdTasteMaxSelect}>
              <SelectTrigger id="prod-taste-max-select" className="w-full max-w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {TASTE_MAX_SELECT_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`${isSet ? "product.sauceMaxSelect" : "product.tasteMaxSelect"}.${value}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {t(isSet ? "product.sauceMaxSelectHint" : "product.tasteMaxSelectHint")}
            </FieldDescription>
          </Field>

          {enabled && selectedTasteBadges.length ? (
            <div className="flex flex-wrap gap-2">
              {selectedTasteBadges.map((item) => (
                <Badge key={item.uuid} className="bg-primary/5 text-foreground">
                  {item.label}
                </Badge>
              ))}
            </div>
          ) : null}

          {enabled ? (
            tasteOptions.length ? (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={tasteSearch}
                    placeholder={t(isSet ? "product.searchSauces" : "product.searchTastes")}
                    onChange={(event) => setTasteSearch(event.target.value)}
                  />
                </div>
                <FieldGroup className="grid gap-3 md:grid-cols-2">
                  {filteredTasteOptions.map((taste) => {
                    const uuid = tasteUuid(taste);
                    const label = entityLabel(
                      taste,
                      "taste_name_eng",
                      "taste_name_la",
                      language,
                      productTasteName(taste) || uuid,
                    );
                    const selected = selectedTasteUuids.has(uuid);
                    return (
                      <Field
                        key={uuid}
                        className={cn(
                          "rounded-md border p-3 transition",
                          selected ? "border-primary bg-primary/5" : "border-border bg-muted/20",
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <Checkbox
                            aria-label={label}
                            checked={selected}
                            onCheckedChange={(checked) => toggleTaste(uuid, checked === true)}
                          />
                          <FieldLabel className="min-w-0 truncate">{label}</FieldLabel>
                        </div>
                      </Field>
                    );
                  })}
                </FieldGroup>
                {!filteredTasteOptions.length ? (
                  <FieldDescription>{t("common.noData")}</FieldDescription>
                ) : null}
              </div>
            ) : (
              <FieldDescription>{t(isSet ? "product.noSauces" : "product.noTastes")}</FieldDescription>
            )
          ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={tasteDialogOpen}
        onOpenChange={(open) => {
          setTasteDialogOpen(open);
          if (!open) resetNewTasteForm();
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingTasteUuid ? t("actions.edit") : t("actions.add")} {optionName}
            </DialogTitle>
            <DialogDescription>{sectionHint}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldSet className="gap-4 rounded-md border bg-muted/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <FieldLegend className="text-sm font-semibold">
                  {editingTasteUuid ? t("settings.editRecord") : t("settings.newRecord")}
                </FieldLegend>
                {editingTasteUuid ? (
                  <Button type="button" size="sm" variant="outline" onClick={resetNewTasteForm}>
                    <RefreshCcw data-icon="inline-start" />
                    {t("actions.new")}
                  </Button>
                ) : null}
              </div>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="new-taste-name-la">{t("fields.nameLa")}</FieldLabel>
                  <Input
                    id="new-taste-name-la"
                    value={newTasteNameLa}
                    onChange={(event) => setNewTasteNameLa(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-taste-name-eng">{t("fields.nameEn")}</FieldLabel>
                  <Input
                    id="new-taste-name-eng"
                    value={newTasteNameEng}
                    onChange={(event) => setNewTasteNameEng(event.target.value)}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
            <div className="flex min-h-0 flex-col gap-3 rounded-md border bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{t(isSet ? "product.sauces" : "product.tastes")}</p>
                <Badge>{t("common.selectedCount", { count: selectedTasteUuids.size })}</Badge>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={tasteSearch}
                  placeholder={t(isSet ? "product.searchSauces" : "product.searchTastes")}
                  onChange={(event) => setTasteSearch(event.target.value)}
                />
              </div>
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                {filteredTasteOptions.map((taste) => {
                  const uuid = tasteUuid(taste);
                  const label = entityLabel(
                    taste,
                    "taste_name_eng",
                    "taste_name_la",
                    language,
                    productTasteName(taste) || uuid,
                  );
                  return (
                    <div key={uuid} className="flex items-center gap-2 rounded-md border bg-background p-3">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto min-w-0 flex-1 justify-start px-0 py-0 text-left hover:bg-transparent"
                        onClick={() => editTaste(taste)}
                      >
                        <span className="truncate text-sm font-semibold">{label}</span>
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={t("actions.edit")} onClick={() => editTaste(taste)}>
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={t("actions.delete")}
                        disabled={tasteSaving}
                        onClick={() => setDeletingTasteUuid(uuid)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTasteDialogOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button type="button" disabled={tasteSaving} onClick={saveTasteFromDialog}>
              {tasteSaving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingTasteUuid)}
        title={`${t("actions.delete")} ${optionName}`}
        description={t("settings.deleteConfirm")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        onConfirm={() => void deleteTasteFromDialog(deletingTasteUuid)}
        onOpenChange={(open) => {
          if (!open) setDeletingTasteUuid("");
        }}
      />
    </>
  );
}
