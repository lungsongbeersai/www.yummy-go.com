"use client";

import { Pencil, Plus, RefreshCcw, Save, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  PRODUCT_FORM_FIELD_IDS,
  TASTE_MAX_SELECT_OPTIONS,
  entityLabel,
  productTasteName,
  tasteUuid,
} from "./product-form-utils";
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
  const searchPlaceholder = t(isSet ? "product.searchSauces" : "product.searchTastes");
  const tasteLabel = (taste: (typeof tasteOptions)[number]) =>
    entityLabel(
      taste,
      "taste_name_eng",
      "taste_name_la",
      language,
      productTasteName(taste) || tasteUuid(taste),
    );
  const searchInput = (
    <InputGroup>
      <InputGroupInput
        value={tasteSearch}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        onChange={(event) => setTasteSearch(event.target.value)}
      />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
  );

  return (
    <>
      {!isSet ? (
        <Card id={PRODUCT_FORM_FIELD_IDS.tastesSection}>
          <CardHeader>
            <CardTitle>{sectionTitle}</CardTitle>
            <CardDescription>{sectionHint}</CardDescription>
            <CardAction>
              <Button
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
            </CardAction>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="prod-taste-max-select">
                  {t(isSet ? "product.sauceMode" : "product.tasteMode")}
                </FieldLabel>
                <Select value={prodTasteMaxSelect} onValueChange={setProdTasteMaxSelect}>
                  <SelectTrigger id="prod-taste-max-select">
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
                    <Badge key={item.uuid} variant="secondary">
                      {item.label}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {enabled ? (
                tasteOptions.length ? (
                  <>
                    {searchInput}
                    {filteredTasteOptions.length ? (
                      <FieldGroup data-slot="checkbox-group" className="grid md:grid-cols-2">
                        {filteredTasteOptions.map((taste) => {
                          const uuid = tasteUuid(taste);
                          const checkboxId = `prod-taste-${uuid}`;
                          return (
                            <FieldLabel key={uuid} htmlFor={checkboxId}>
                              <Field orientation="horizontal">
                                <Checkbox
                                  id={checkboxId}
                                  checked={selectedTasteUuids.has(uuid)}
                                  onCheckedChange={(checked) => toggleTaste(uuid, checked === true)}
                                />
                                <FieldContent>
                                  <FieldTitle>{tasteLabel(taste)}</FieldTitle>
                                </FieldContent>
                              </Field>
                            </FieldLabel>
                          );
                        })}
                      </FieldGroup>
                    ) : (
                      <FieldDescription>{t("common.noData")}</FieldDescription>
                    )}
                  </>
                ) : (
                  <FieldDescription>{t(isSet ? "product.noSauces" : "product.noTastes")}</FieldDescription>
                )
              ) : null}
            </FieldGroup>
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingTasteUuid ? t("actions.edit") : t("actions.add")} {optionName}
            </DialogTitle>
            <DialogDescription>{sectionHint}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <FieldSet>
              <FieldLegend>
                {editingTasteUuid ? t("settings.editRecord") : t("settings.newRecord")}
              </FieldLegend>
              <FieldGroup>
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
            <FieldSet>
              <FieldLegend>{t(isSet ? "product.sauces" : "product.tastes")}</FieldLegend>
              <FieldDescription>
                {t("common.selectedCount", { count: selectedTasteUuids.size })}
              </FieldDescription>
              {searchInput}
              <ItemGroup className="max-h-80 overflow-y-auto">
                {filteredTasteOptions.map((taste) => {
                  const uuid = tasteUuid(taste);
                  return (
                    <Item key={uuid} size="sm" variant="outline">
                      <ItemContent>
                        <ItemTitle>{tasteLabel(taste)}</ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("actions.edit")}
                          onClick={() => editTaste(taste)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("actions.delete")}
                          disabled={tasteSaving}
                          onClick={() => setDeletingTasteUuid(uuid)}
                        >
                          <Trash2 />
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
              {!filteredTasteOptions.length ? (
                <FieldDescription>{t("common.noData")}</FieldDescription>
              ) : null}
            </FieldSet>
          </div>
          <DialogFooter>
            {editingTasteUuid ? (
              <Button type="button" variant="outline" onClick={resetNewTasteForm}>
                <RefreshCcw data-icon="inline-start" />
                {t("actions.new")}
              </Button>
            ) : null}
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
