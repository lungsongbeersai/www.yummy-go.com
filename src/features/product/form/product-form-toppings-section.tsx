"use client";

import { Pencil, Plus, RefreshCcw, Save, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
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
  ItemDescription,
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
import type { BinaryFlag } from "./product-form-types";
import {
  PRODUCT_FORM_FIELD_IDS,
  TOPPING_HAS,
  TOPPING_MAX_SELECT_OPTIONS,
  TOPPING_MAX_SELECT_UNLIMITED,
  entityLabel,
  productToppingName,
  toppingUuid,
} from "./product-form-utils";
import { ProductFormChoiceGroup } from "./product-form-choice-group";
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
    prodToppingMaxSelect,
    setProdToppingMaxSelect,
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
  const hasToppings = prodToppingStatus === TOPPING_HAS;
  const searchPlaceholder = t("product.searchToppings");
  const toppingLabel = (topping: (typeof toppingOptions)[number]) =>
    entityLabel(
      topping,
      "topping_name_eng",
      "topping_name_la",
      language,
      productToppingName(topping) || toppingUuid(topping),
    );
  const searchInput = (
    <InputGroup>
      <InputGroupInput
        value={toppingSearch}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        onChange={(event) => setToppingSearch(event.target.value)}
      />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
  );

  return (
    <>
      <Card id={PRODUCT_FORM_FIELD_IDS.toppingsSection}>
        <CardHeader>
          <CardTitle>{t("product.sections.toppings")}</CardTitle>
          <CardDescription>{t("product.sections.toppingsHint")}</CardDescription>
          <CardAction>
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
          </CardAction>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <ProductFormChoiceGroup
              id="prod-topping-mode"
              legend={t("product.toppingMode")}
              className="sm:grid-cols-2"
              choices={toppingModeChoices}
              value={prodToppingStatus}
              onValueChange={(value) => setProdToppingStatus(value as BinaryFlag)}
            />
            {hasToppings ? (
              <>
                <Field>
                  <FieldLabel htmlFor="prod-topping-max-select">
                    {t("product.toppingMaxSelect")}
                  </FieldLabel>
                  <Select
                    value={prodToppingMaxSelect || TOPPING_MAX_SELECT_UNLIMITED}
                    onValueChange={setProdToppingMaxSelect}
                  >
                    <SelectTrigger id="prod-topping-max-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value={TOPPING_MAX_SELECT_UNLIMITED}>
                          {t("product.unlimited")}
                        </SelectItem>
                        {TOPPING_MAX_SELECT_OPTIONS.map((value) => (
                          <SelectItem key={value} value={String(value)}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t("product.toppingMaxSelectHint")}</FieldDescription>
                </Field>

                {selectedToppingBadges.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedToppingBadges.map((item) => (
                      <Badge key={item.uuid} variant="secondary">
                        {item.label} - {item.price}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {toppingOptions.length ? (
                  <>
                    {searchInput}
                    {filteredToppingOptions.length ? (
                      <FieldGroup data-slot="checkbox-group" className="grid md:grid-cols-2">
                        {filteredToppingOptions.map((topping) => {
                          const uuid = toppingUuid(topping);
                          const selected = selectedToppingMap.get(uuid);
                          const checkboxId = `prod-topping-${uuid}`;
                          return (
                            <Field key={uuid}>
                              <FieldLabel htmlFor={checkboxId}>
                                <Field orientation="horizontal">
                                  <Checkbox
                                    id={checkboxId}
                                    checked={Boolean(selected)}
                                    onCheckedChange={(checked) => toggleTopping(uuid, checked === true)}
                                  />
                                  <FieldContent>
                                    <FieldTitle>{toppingLabel(topping)}</FieldTitle>
                                  </FieldContent>
                                </Field>
                              </FieldLabel>
                              {/* Kept outside the label: a second control inside a label is invalid. */}
                              {selected ? (
                                <FormattedNumberInput
                                  aria-label={`${t("fields.topping_price")} ${toppingLabel(topping)}`}
                                  placeholder={t("fields.topping_price")}
                                  min={0}
                                  value={selected.topping_price}
                                  onValueChange={(value) => updateToppingPrice(uuid, value)}
                                />
                              ) : null}
                            </Field>
                          );
                        })}
                      </FieldGroup>
                    ) : (
                      <FieldDescription>{t("common.noData")}</FieldDescription>
                    )}
                  </>
                ) : (
                  <FieldDescription>-</FieldDescription>
                )}
              </>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>

      <Dialog
        open={toppingDialogOpen}
        onOpenChange={(open) => {
          setToppingDialogOpen(open);
          if (!open) resetNewToppingForm();
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingToppingUuid ? t("actions.edit") : t("actions.add")} {t("nav.topping")}
            </DialogTitle>
            <DialogDescription>{t("product.sections.toppingsHint")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            <FieldSet>
              <FieldLegend>
                {editingToppingUuid ? t("settings.editRecord") : t("settings.newRecord")}
              </FieldLegend>
              <FieldGroup>
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

            <FieldSet>
              <FieldLegend>{t("settings.modules.topping.title")}</FieldLegend>
              <FieldDescription>
                {t("common.total")}: {toppingOptions.length} ·{" "}
                {t("common.selectedCount", { count: selectedToppings.length })}
              </FieldDescription>
              {searchInput}
              <ItemGroup className="max-h-80 overflow-y-auto">
                {filteredToppingOptions.map((topping) => {
                  const uuid = toppingUuid(topping);
                  const selected = selectedToppingMap.get(uuid);
                  return (
                    <Item key={uuid} size="sm" variant={selected ? "muted" : "outline"}>
                      <ItemContent>
                        <ItemTitle>{toppingLabel(topping)}</ItemTitle>
                        <ItemDescription>
                          {String(topping.topping_name_eng ?? "") || t("fields.nameEn")}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        {selected ? (
                          <Badge variant="secondary">{selected.topping_price || "0"}</Badge>
                        ) : null}
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("actions.edit")}
                          onClick={() => editTopping(topping)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("actions.delete")}
                          disabled={toppingSaving}
                          onClick={() => setDeletingToppingUuid(uuid)}
                        >
                          <Trash2 />
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
              {!filteredToppingOptions.length ? (
                <FieldDescription>{t("common.noData")}</FieldDescription>
              ) : null}
            </FieldSet>
          </div>

          <DialogFooter>
            {editingToppingUuid ? (
              <Button type="button" variant="outline" onClick={resetNewToppingForm}>
                <RefreshCcw data-icon="inline-start" />
                {t("actions.new")}
              </Button>
            ) : null}
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
