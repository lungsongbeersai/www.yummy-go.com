"use client";

import { Check, Pencil, Plus, RefreshCcw, Save, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { BinaryFlag } from "./product-form-types";
import {
  TOPPING_HAS,
  choiceCardClass,
  choiceMarkClass,
  entityLabel,
  productToppingName,
  toppingUuid,
} from "./product-form-utils";
import { ProductFormSectionNumber } from "./product-form-section-number";
import type { ProductFormWorkflow } from "./use-product-form-workflow";

export function ProductFormToppingsSection({ form }: { form: ProductFormWorkflow }) {
  const {
    t,
    storeUuid,
    toppingSaving,
    setProdToppingStatus,
    setToppingDialogOpen,
    toppingModeChoices,
    prodToppingStatus,
    selectedToppingBadges,
    toppingOptions,
    filteredToppingOptions,
    toppingSearch,
    setToppingSearch,
    selectedToppingMap,
    toggleTopping,
    updateToppingPrice,
    toppingDialogOpen,
    resetNewToppingForm,
    editingToppingUuid,
    newToppingNameLa,
    setNewToppingNameLa,
    newToppingNameEng,
    setNewToppingNameEng,
    newToppingPrice,
    setNewToppingPrice,
    saveToppingFromDialog,
    selectedToppings,
    editTopping,
    setDeletingToppingUuid,
    deletingToppingUuid,
    deleteToppingFromDialog,
    language,
  } = form;

  return (
    <>          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ProductFormSectionNumber value="4" />
                <div className="min-w-0">
                  <CardTitle>{t("product.sections.toppings")}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{t("product.sections.toppingsHint")}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!storeUuid || toppingSaving}
                onClick={() => {
                  setProdToppingStatus(TOPPING_HAS);
                  setToppingDialogOpen(true);
                }}
              >
                <Plus data-icon="inline-start" />
                {t("actions.add")} {t("nav.topping")}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel>{t("product.toppingMode")}</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {toppingModeChoices.map((choice) => {
                  const active = prodToppingStatus === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      className={choiceCardClass(active)}
                      aria-pressed={active}
                      onClick={() => setProdToppingStatus(choice.value as BinaryFlag)}
                    >
                      <span className={choiceMarkClass(active)}>
                        <Check className="size-3" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{choice.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{choice.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
            {prodToppingStatus === TOPPING_HAS && selectedToppingBadges.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedToppingBadges.map((item) => (
                  <Badge key={item.uuid} className="bg-primary/5 text-foreground">
                    {item.label} - {item.price}
                  </Badge>
                ))}
              </div>
            ) : null}
            {prodToppingStatus === TOPPING_HAS ? (
              toppingOptions.length ? (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={toppingSearch}
                      placeholder={t("product.searchToppings")}
                      onChange={(event) => setToppingSearch(event.target.value)}
                    />
                  </div>
                  <FieldGroup className="grid gap-3 md:grid-cols-2">
                  {filteredToppingOptions.map((topping) => {
                    const uuid = toppingUuid(topping);
                    const label = entityLabel(topping, "topping_name_eng", "topping_name_la", language, productToppingName(topping) || uuid);
                    const selected = selectedToppingMap.get(uuid);
                    return (
                      <Field
                        key={uuid}
                        className={cn(
                          "rounded-md border p-3 transition",
                          selected ? "border-primary bg-primary/5" : "border-border bg-muted/20"
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <Checkbox
                            aria-label={label}
                            checked={Boolean(selected)}
                            onChange={(event) => toggleTopping(uuid, event.target.checked)}
                          />
                          <FieldContent className="min-w-0">
                            <FieldLabel className="truncate">
                              {label}
                            </FieldLabel>
                            <FieldDescription>{t("fields.topping_price")}</FieldDescription>
                          </FieldContent>
                        </div>
                        {selected ? (
                          <Field className="mt-3 gap-2">
                            <FormattedNumberInput
                              min={0}
                              value={selected.topping_price}
                              onValueChange={(value) => updateToppingPrice(uuid, value)}
                            />
                          </Field>
                        ) : null}
                      </Field>
                    );
                  })}
                  </FieldGroup>
                  {!filteredToppingOptions.length ? (
                    <FieldDescription>{t("common.noData")}</FieldDescription>
                  ) : null}
                </div>
              ) : (
                <FieldDescription>-</FieldDescription>
              )
            ) : null}
          </CardContent>
          </Card>

          <Dialog
            open={toppingDialogOpen}
            onOpenChange={(open) => {
              setToppingDialogOpen(open);
              if (!open) resetNewToppingForm();
            }}
          >
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  {editingToppingUuid ? t("actions.edit") : t("actions.add")} {t("nav.topping")}
                </DialogTitle>
                <DialogDescription>{t("product.sections.toppingsHint")}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 lg:grid-cols-2">
                <FieldSet className="gap-4 rounded-md border bg-muted/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <FieldLegend className="mb-1 text-sm font-black">
                        {editingToppingUuid ? t("settings.editRecord") : t("settings.newRecord")}
                      </FieldLegend>
                      <FieldDescription>{t("fields.topping_price")}</FieldDescription>
                    </div>
                    {editingToppingUuid ? (
                      <Button type="button" size="sm" variant="outline" onClick={resetNewToppingForm}>
                        <RefreshCcw data-icon="inline-start" />
                        {t("actions.new")}
                      </Button>
                    ) : null}
                  </div>
                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel htmlFor="new-topping-name-la">{t("fields.nameLa")}</FieldLabel>
                      <Input
                        id="new-topping-name-la"
                        value={newToppingNameLa}
                        onChange={(event) => setNewToppingNameLa(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="new-topping-name-eng">{t("fields.nameEn")}</FieldLabel>
                      <Input
                        id="new-topping-name-eng"
                        value={newToppingNameEng}
                        onChange={(event) => setNewToppingNameEng(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="new-topping-price">{t("fields.topping_price")}</FieldLabel>
                      <FormattedNumberInput
                        id="new-topping-price"
                        min={0}
                        value={newToppingPrice}
                        onValueChange={setNewToppingPrice}
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <div className="flex min-h-0 flex-col gap-3 rounded-md border bg-muted/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black">{t("settings.modules.topping.title")}</p>
                      <p className="text-xs text-muted-foreground">{t("common.total")}: {toppingOptions.length}</p>
                    </div>
                    <Badge>{t("common.selectedCount", { count: selectedToppings.length })}</Badge>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={toppingSearch}
                      placeholder={t("product.searchToppings")}
                      onChange={(event) => setToppingSearch(event.target.value)}
                    />
                  </div>
                  <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                    {filteredToppingOptions.map((topping) => {
                      const uuid = toppingUuid(topping);
                      const label = entityLabel(
                        topping,
                        "topping_name_eng",
                        "topping_name_la",
                        language,
                        productToppingName(topping) || uuid
                      );
                      const selected = selectedToppingMap.get(uuid);

                      return (
                        <div
                          key={uuid}
                          className={cn(
                            "flex items-center gap-2 rounded-md border bg-background p-3",
                            selected ? "border-primary" : "border-border"
                          )}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => editTopping(topping)}
                          >
                            <span className="block truncate text-sm font-black">{label}</span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                              {String(topping.topping_name_eng ?? "") || t("fields.nameEn")}
                            </span>
                          </button>
                          {selected ? <Badge className="shrink-0">{selected.topping_price || "0"}</Badge> : null}
                          <Button
                            type="button"
                            size="iconSm"
                            variant="ghost"
                            aria-label={t("actions.edit")}
                            onClick={() => editTopping(topping)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            size="iconSm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            aria-label={t("actions.delete")}
                            disabled={toppingSaving}
                            onClick={() => setDeletingToppingUuid(uuid)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      );
                    })}
                    {!filteredToppingOptions.length ? (
                      <FieldDescription>{t("common.noData")}</FieldDescription>
                    ) : null}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setToppingDialogOpen(false)}>
                  {t("actions.cancel")}
                </Button>
                <Button type="button" disabled={toppingSaving} onClick={saveToppingFromDialog}>
                  {toppingSaving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                  {t("actions.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={Boolean(deletingToppingUuid)}
            title={`${t("actions.delete")} ${t("nav.topping")}`}
            description={t("settings.deleteConfirm")}
            cancelLabel={t("actions.cancel")}
            confirmLabel={t("actions.delete")}
            onConfirm={() => void deleteToppingFromDialog(deletingToppingUuid)}
            onOpenChange={(open) => {
              if (!open) setDeletingToppingUuid("");
            }}
          />
    </>
  );
}
