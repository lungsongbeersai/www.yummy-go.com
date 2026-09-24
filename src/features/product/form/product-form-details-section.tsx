"use client";

import { Info, Pencil, Plus, RefreshCcw, Save, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
  ItemHeader,
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
import { Switch } from "@/components/ui/switch";
import type { BinaryFlag, SetChoiceGroupMode } from "./product-form-types";
import {
  PRODUCT_FORM_FIELD_IDS,
  SET_CHOICE_GROUP_MODE_OPTIONS,
  TASTE_MAX_SELECT_OPTIONS,
  binaryFlag,
  detailFieldId,
  detailGroupFieldId,
  emptySetDetailOptionGroup,
  entityLabel,
  setChildOptionName,
  setChildOptionUuid,
  sizeName,
  sizeUuid,
  tasteUuid,
} from "./product-form-utils";
import type { ProductFormWorkflow } from "./use-product-form-workflow";

const NO_SET_PRODUCT_OPTION_VALUE = "__no-set-products__";

export function ProductFormDetailsSection({ form }: { form: ProductFormWorkflow }) {
  const {
    t,
    detailStockState,
    detailStockStateLabel,
    detailStockActionLabel,
    details,
    bulkStockSaving,
    updateAllDetailStockModes,
    addDetail,
    typeLabel,
    detailModeHint,
    sizeOptions,
    setOptionOptions,
    setChildOptionOptions,
    filteredSetOptionOptions,
    isSetChildOptionDialog,
    tasteOptions,
    setTasteDialogOpen,
    resetNewTasteForm,
    language,
    statusSortFk,
    sizeSaving,
    updateDetail,
    removeDetail,
    setOptionDialogOpen,
    handleSetOptionDialogOpen,
    setOptionNameLa,
    setSetOptionNameLa,
    setOptionNameEng,
    setSetOptionNameEng,
    setOptionSearch,
    setSetOptionSearch,
    editingSetOptionUuid,
    deletingSetOptionUuid,
    setDeletingSetOptionUuid,
    setOptionSaving,
    resetSetOptionForm,
    editSetOption,
    saveSetOptionFromDialog,
    deleteSetOptionFromDialog,
    openSizeDialog,
    openSetChildOptionDialog,
    invalidFieldIds,
  } = form;
  const isSet = statusSortFk === "2";
  const detailItemLabel = isSet ? t("pos.product") : t("fields.size");
  const showNoSetProductOptions = isSet && !sizeOptions.length;
  const sizeSelectKey = showNoSetProductOptions ? "empty" : sizeOptions.length ? "ready" : "loading";
  const sauceLabel = (taste: (typeof tasteOptions)[number]) =>
    entityLabel(taste, "taste_name_eng", "taste_name_la", language, tasteUuid(taste));
  const setOptionListTitle = t(
    isSetChildOptionDialog ? "product.setChildOptions" : "product.setProductOptions",
  );

  return (
    <>
      <Card id={PRODUCT_FORM_FIELD_IDS.detailsSection}>
        <CardHeader>
          <CardTitle>{t("product.sections.details")}</CardTitle>
          <CardDescription>{t("product.sections.detailsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {!isSet ? (
              <Alert>
                <Info />
                <AlertTitle>{typeLabel}</AlertTitle>
                <AlertDescription>{detailModeHint}</AlertDescription>
              </Alert>
            ) : null}

            {details.map((row, index) => {
              const selectedSize = sizeOptions.find((size) => sizeUuid(size) === row.size_uuid_fk);
              const selectedSizeLabel = selectedSize
                ? entityLabel(selectedSize, "size_name_eng", "size_name_la", language, sizeName(selectedSize) || row.size_uuid_fk)
                : detailItemLabel;
              const rowStockLabel =
                binaryFlag(row.pro_detail_stock, "1") === "1"
                  ? t("product.stockMode.deduct")
                  : t("product.stockMode.noDeduct");
              const otherSelectedSizeUuids = new Set(
                details
                  .filter((otherRow) => otherRow.id !== row.id && otherRow.size_uuid_fk)
                  .map((otherRow) => otherRow.size_uuid_fk),
              );
              const availableSizeOptions = sizeOptions.filter(
                (size) => !otherSelectedSizeUuids.has(sizeUuid(size)),
              );
              const fieldId = (name: string) => detailFieldId(row.id, name);
              const invalid = (name: string) => invalidFieldIds.has(fieldId(name));

              return (
                <Card key={row.id} id={fieldId("card")} size="sm">
                  <CardHeader>
                    <CardTitle>#{index + 1}</CardTitle>
                    <CardDescription>{selectedSizeLabel}</CardDescription>
                    <CardAction>
                      <ButtonGroup>
                        {isSet ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateDetail(row.id, {
                                set_choice_group_mode:
                                  row.set_choice_group_mode === "none" ? "one" : row.set_choice_group_mode,
                                set_choice_group_names: [],
                                set_option_groups: [...row.set_option_groups, emptySetDetailOptionGroup()],
                              })
                            }
                          >
                            <Plus data-icon="inline-start" />
                            {t("product.addSetChildOption")}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          disabled={details.length <= 1}
                          aria-label={t("actions.delete")}
                          onClick={() => removeDetail(row.id)}
                        >
                          <Trash2 />
                        </Button>
                      </ButtonGroup>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <FieldGroup className="grid md:grid-cols-2 lg:grid-cols-3">
                        <Field data-invalid={invalid("size")}>
                          <FieldLabel htmlFor={fieldId("size")}>{detailItemLabel}</FieldLabel>
                          <ButtonGroup>
                            <Select
                              key={sizeSelectKey}
                              value={row.size_uuid_fk}
                              onValueChange={(value) => {
                                if (value === NO_SET_PRODUCT_OPTION_VALUE) return;
                                const selectedOption = sizeOptions.find((size) => sizeUuid(size) === value);
                                const automaticGroupName = selectedOption
                                  ? entityLabel(selectedOption, "size_name_eng", "size_name_la", language, value)
                                  : value;
                                updateDetail(row.id, {
                                  size_uuid_fk: value,
                                  ...(isSet &&
                                  !row.set_option_groups.length &&
                                  row.set_choice_group_mode !== "none"
                                    ? { set_choice_group_names: [automaticGroupName] }
                                    : {}),
                                });
                              }}
                            >
                              <SelectTrigger id={fieldId("size")} aria-invalid={invalid("size")} className="flex-1">
                                <SelectValue placeholder={detailItemLabel} />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                <SelectGroup>
                                  {showNoSetProductOptions ? (
                                    <SelectItem value={NO_SET_PRODUCT_OPTION_VALUE} disabled>
                                      {t("product.noSetProductOptions")}
                                    </SelectItem>
                                  ) : null}
                                  {availableSizeOptions.map((size) => {
                                    const uuid = sizeUuid(size);
                                    return (
                                      <SelectItem key={uuid} value={uuid}>
                                        {entityLabel(size, "size_name_eng", "size_name_la", language, sizeName(size) || uuid)}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label={`${t("actions.add")} ${detailItemLabel}`}
                              disabled={isSet ? setOptionSaving : sizeSaving}
                              onClick={() => openSizeDialog(row.id)}
                            >
                              <Plus />
                            </Button>
                          </ButtonGroup>
                        </Field>
                        <Field data-invalid={invalid("bprice")}>
                          <FieldLabel htmlFor={fieldId("bprice")}>{t("fields.bprice")}</FieldLabel>
                          <FormattedNumberInput
                            id={fieldId("bprice")}
                            aria-invalid={invalid("bprice")}
                            min={0}
                            value={row.pro_detail_bprice}
                            onValueChange={(value) => updateDetail(row.id, { pro_detail_bprice: value })}
                          />
                        </Field>
                        {!isSet ? (
                          <Field data-invalid={invalid("sprice")}>
                            <FieldLabel htmlFor={fieldId("sprice")}>{t("fields.sprice")}</FieldLabel>
                            <FormattedNumberInput
                              id={fieldId("sprice")}
                              aria-invalid={invalid("sprice")}
                              placeholder="0"
                              min={1}
                              value={row.pro_detail_sprice}
                              onValueChange={(value) => updateDetail(row.id, { pro_detail_sprice: value })}
                            />
                          </Field>
                        ) : null}
                        <Field>
                          <FieldLabel htmlFor={fieldId("qty-stock")}>{t("fields.qtyStock")}</FieldLabel>
                          <FormattedNumberInput
                            id={fieldId("qty-stock")}
                            min={0}
                            value={row.pro_detail_qty_stock}
                            onValueChange={(value) => updateDetail(row.id, { pro_detail_qty_stock: value })}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={fieldId("stock")}>{t("product.detailStockStatus")}</FieldLabel>
                          {isSet ? (
                            <Select
                              value={row.pro_detail_stock}
                              disabled={bulkStockSaving}
                              onValueChange={(value) => updateDetail(row.id, { pro_detail_stock: value as BinaryFlag })}
                            >
                              <SelectTrigger id={fieldId("stock")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                <SelectGroup>
                                  <SelectItem value="1">{t("product.stockMode.deduct")}</SelectItem>
                                  <SelectItem value="2">{t("product.stockMode.noDeduct")}</SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          ) : (
                            // Non-set rows follow the bulk stock switch below, so this is display-only.
                            <Input id={fieldId("stock")} value={rowStockLabel} readOnly />
                          )}
                        </Field>
                        {isSet ? (
                          <Field data-invalid={invalid("set-qty")}>
                            <FieldLabel htmlFor={fieldId("set-qty")}>{t("product.setQtyCutStock")}</FieldLabel>
                            <FormattedNumberInput
                              id={fieldId("set-qty")}
                              aria-invalid={invalid("set-qty")}
                              min={1}
                              value={row.pro_detail_setqty_cut_stock}
                              onValueChange={(value) => updateDetail(row.id, { pro_detail_setqty_cut_stock: value })}
                            />
                            <FieldDescription>{t("product.setQtyCutStockHint")}</FieldDescription>
                          </Field>
                        ) : null}
                        {isSet ? (
                          <Field data-invalid={invalid("group-mode")}>
                            <FieldLabel htmlFor={fieldId("group-mode")}>{t("product.setChoiceGroupMode")}</FieldLabel>
                            <Select
                              value={row.set_choice_group_mode}
                              onValueChange={(value) =>
                                updateDetail(row.id, {
                                  set_choice_group_mode: value as SetChoiceGroupMode,
                                  set_choice_group_names:
                                    value === "none" || row.set_option_groups.length ? [] : [selectedSizeLabel],
                                })
                              }
                            >
                              <SelectTrigger id={fieldId("group-mode")} aria-invalid={invalid("group-mode")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                <SelectGroup>
                                  {SET_CHOICE_GROUP_MODE_OPTIONS.map((mode) => (
                                    <SelectItem key={mode} value={mode}>
                                      {t(`product.setChoiceGroupModeOption.${mode}`)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                        ) : null}
                        {statusSortFk === "1" ? (
                          <Field>
                            <FieldLabel htmlFor={fieldId("enabled")}>{t("product.detailEnabledStatus")}</FieldLabel>
                            <Select
                              value={row.pro_detail_enabled}
                              onValueChange={(value) => updateDetail(row.id, { pro_detail_enabled: value as BinaryFlag })}
                            >
                              <SelectTrigger id={fieldId("enabled")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                <SelectGroup>
                                  <SelectItem value="1">{t("common.active")}</SelectItem>
                                  <SelectItem value="2">{t("common.inactive")}</SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                        ) : null}
                        {statusSortFk === "3" ? (
                          <>
                            <Field>
                              <FieldLabel htmlFor={fieldId("buy-qty")}>{t("product.buyQty")}</FieldLabel>
                              <FormattedNumberInput
                                id={fieldId("buy-qty")}
                                min={0}
                                value={row.pro_detail_cus_qtyBuy}
                                onValueChange={(value) => updateDetail(row.id, { pro_detail_cus_qtyBuy: value })}
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={fieldId("free-qty")}>{t("product.freeQty")}</FieldLabel>
                              <FormattedNumberInput
                                id={fieldId("free-qty")}
                                min={0}
                                value={row.pro_detail_cus_qtyFree}
                                onValueChange={(value) => updateDetail(row.id, { pro_detail_cus_qtyFree: value })}
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={fieldId("promo-time")}>{t("product.promotionTime.label")}</FieldLabel>
                              <Select
                                value={row.pro_detail_status}
                                onValueChange={(value) => updateDetail(row.id, { pro_detail_status: value as BinaryFlag })}
                              >
                                <SelectTrigger id={fieldId("promo-time")}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  <SelectGroup>
                                    <SelectItem value="1">{t("product.promotionTime.dateOnly")}</SelectItem>
                                    <SelectItem value="2">{t("product.promotionTime.timeRange")}</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field data-invalid={invalid("start-date")}>
                              <FieldLabel htmlFor={fieldId("start-date")}>{t("product.startDate")}</FieldLabel>
                              <Input
                                id={fieldId("start-date")}
                                aria-invalid={invalid("start-date")}
                                type="date"
                                value={row.pro_detail_sDate}
                                onChange={(event) => updateDetail(row.id, { pro_detail_sDate: event.target.value })}
                              />
                            </Field>
                            <Field data-invalid={invalid("end-date")}>
                              <FieldLabel htmlFor={fieldId("end-date")}>{t("product.endDate")}</FieldLabel>
                              <Input
                                id={fieldId("end-date")}
                                aria-invalid={invalid("end-date")}
                                type="date"
                                value={row.pro_detail_eDate}
                                onChange={(event) => updateDetail(row.id, { pro_detail_eDate: event.target.value })}
                              />
                            </Field>
                            {row.pro_detail_status === "2" ? (
                              <>
                                <Field data-invalid={invalid("start-time")}>
                                  <FieldLabel htmlFor={fieldId("start-time")}>{t("product.startTime")}</FieldLabel>
                                  <Input
                                    id={fieldId("start-time")}
                                    aria-invalid={invalid("start-time")}
                                    type="time"
                                    value={row.pro_detail_sTime}
                                    onChange={(event) => updateDetail(row.id, { pro_detail_sTime: event.target.value })}
                                  />
                                </Field>
                                <Field data-invalid={invalid("end-time")}>
                                  <FieldLabel htmlFor={fieldId("end-time")}>{t("product.endTime")}</FieldLabel>
                                  <Input
                                    id={fieldId("end-time")}
                                    aria-invalid={invalid("end-time")}
                                    type="time"
                                    value={row.pro_detail_eTime}
                                    onChange={(event) => updateDetail(row.id, { pro_detail_eTime: event.target.value })}
                                  />
                                </Field>
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </FieldGroup>

                      {isSet
                        ? row.set_option_groups.map((group, groupIndex) => {
                            const updateGroup = (patch: Partial<typeof group>) =>
                              updateDetail(row.id, {
                                set_option_groups: row.set_option_groups.map((candidate) =>
                                  candidate.id === group.id ? { ...candidate, ...patch } : candidate,
                                ),
                              });
                            const groupFieldId = (name: string) => detailGroupFieldId(row.id, group.id, name);
                            const groupInvalid = (name: string) => invalidFieldIds.has(groupFieldId(name));
                            return (
                              <Item key={group.id} variant="outline">
                                <ItemHeader>
                                  <ItemTitle>
                                    {t("product.setChildOption")} #{groupIndex + 1}
                                  </ItemTitle>
                                  <ItemActions>
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={t("actions.delete")}
                                      onClick={() => {
                                        const nextGroups = row.set_option_groups.filter(
                                          (candidate) => candidate.id !== group.id,
                                        );
                                        updateDetail(row.id, {
                                          set_option_groups: nextGroups,
                                          ...(nextGroups.length
                                            ? {}
                                            : { set_choice_group_mode: "none", set_choice_group_names: [] }),
                                        });
                                      }}
                                    >
                                      <Trash2 />
                                    </Button>
                                  </ItemActions>
                                </ItemHeader>
                                <ItemContent>
                                  <FieldGroup>
                                    <FieldGroup className="grid md:grid-cols-2">
                                      <Field data-invalid={groupInvalid("option")}>
                                        <FieldLabel htmlFor={groupFieldId("option")}>
                                          {t("product.setChildOption")}
                                        </FieldLabel>
                                        <ButtonGroup>
                                          <Select
                                            value={group.set_child_option_uuid_fk}
                                            onValueChange={(value) => {
                                              const selected = setChildOptionOptions.find(
                                                (option) => setChildOptionUuid(option) === value,
                                              );
                                              const nameLa = selected
                                                ? String(
                                                    selected.set_child_option_name_la ??
                                                      setChildOptionName(selected) ??
                                                      value,
                                                  )
                                                : value;
                                              const nameEng = selected
                                                ? String(selected.set_child_option_name_eng ?? nameLa)
                                                : nameLa;
                                              updateGroup({
                                                set_child_option_uuid_fk: value,
                                                group_name_la: nameLa,
                                                group_name_eng: nameEng,
                                              });
                                            }}
                                          >
                                            <SelectTrigger id={groupFieldId("option")} aria-invalid={groupInvalid("option")} className="flex-1">
                                              <SelectValue placeholder={t("product.selectSetChildOption")} />
                                            </SelectTrigger>
                                            <SelectContent position="popper">
                                              <SelectGroup>
                                                {setChildOptionOptions
                                                  .filter((option) => {
                                                    const uuid = setChildOptionUuid(option);
                                                    return !row.set_option_groups.some(
                                                      (candidate) =>
                                                        candidate.id !== group.id &&
                                                        candidate.set_child_option_uuid_fk === uuid,
                                                    );
                                                  })
                                                  .map((option) => {
                                                    const uuid = setChildOptionUuid(option);
                                                    return (
                                                      <SelectItem key={uuid} value={uuid}>
                                                        {entityLabel(
                                                          option,
                                                          "set_child_option_name_eng",
                                                          "set_child_option_name_la",
                                                          language,
                                                          setChildOptionName(option) || uuid,
                                                        )}
                                                      </SelectItem>
                                                    );
                                                  })}
                                              </SelectGroup>
                                            </SelectContent>
                                          </Select>
                                          <Button
                                            type="button"
                                            size="icon"
                                            variant="outline"
                                            aria-label={`${t("actions.add")} ${t("product.setChildOption")}`}
                                            disabled={setOptionSaving}
                                            onClick={() => openSetChildOptionDialog(row.id, group.id)}
                                          >
                                            <Plus />
                                          </Button>
                                        </ButtonGroup>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={groupFieldId("max")}>
                                          {t("product.setSauceMaxSelect")}
                                        </FieldLabel>
                                        <Select
                                          value={group.max_select}
                                          onValueChange={(value) => updateGroup({ max_select: value })}
                                        >
                                          <SelectTrigger id={groupFieldId("max")}>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent position="popper">
                                            <SelectGroup>
                                              {TASTE_MAX_SELECT_OPTIONS.filter((value) => value !== "0").map((value) => (
                                                <SelectItem key={value} value={value}>
                                                  {t(`product.tasteMaxSelect.${value}`)}
                                                </SelectItem>
                                              ))}
                                            </SelectGroup>
                                          </SelectContent>
                                        </Select>
                                      </Field>
                                    </FieldGroup>
                                    <FieldSet id={groupFieldId("sauces")} data-invalid={groupInvalid("sauces")}>
                                      <FieldLegend variant="label">{t("product.sauces")}</FieldLegend>
                                      {tasteOptions.length ? (
                                        <FieldGroup
                                          data-slot="checkbox-group"
                                          className="grid sm:grid-cols-2 lg:grid-cols-3"
                                        >
                                          {tasteOptions.map((sauce) => {
                                            const uuid = tasteUuid(sauce);
                                            const checkboxId = groupFieldId(`sauce-${uuid}`);
                                            return (
                                              <Field key={uuid} orientation="horizontal">
                                                <Checkbox
                                                  id={checkboxId}
                                                  checked={group.taste_uuid_fks.includes(uuid)}
                                                  onCheckedChange={(checked) =>
                                                    updateGroup({
                                                      taste_uuid_fks: checked
                                                        ? [...group.taste_uuid_fks, uuid]
                                                        : group.taste_uuid_fks.filter((item) => item !== uuid),
                                                    })
                                                  }
                                                />
                                                <FieldLabel htmlFor={checkboxId} className="font-normal">
                                                  {sauceLabel(sauce)}
                                                </FieldLabel>
                                              </Field>
                                            );
                                          })}
                                        </FieldGroup>
                                      ) : (
                                        <FieldDescription>{t("product.noSauces")}</FieldDescription>
                                      )}
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="self-start"
                                        onClick={() => {
                                          resetNewTasteForm();
                                          setTasteDialogOpen(true);
                                        }}
                                      >
                                        <Plus data-icon="inline-start" />
                                        {t("actions.add")} {t("product.sauce")}
                                      </Button>
                                    </FieldSet>
                                  </FieldGroup>
                                </ItemContent>
                              </Item>
                            );
                          })
                        : null}
                    </FieldGroup>
                  </CardContent>
                </Card>
              );
            })}

            <Button type="button" variant="outline" disabled={bulkStockSaving} onClick={addDetail}>
              <Plus data-icon="inline-start" />
              {t("product.addDetail")}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("product.stockBulk.label")}</CardTitle>
          <CardDescription>{t("product.stockBulk.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldLabel htmlFor="prod-stock-bulk">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{detailStockStateLabel}</FieldTitle>
                <FieldDescription>{detailStockActionLabel}</FieldDescription>
              </FieldContent>
              <Switch
                id="prod-stock-bulk"
                checked={detailStockState === "deduct"}
                disabled={!details.length || bulkStockSaving}
                onCheckedChange={(checked) => void updateAllDetailStockModes(checked ? "1" : "2")}
              />
            </Field>
          </FieldLabel>
        </CardContent>
      </Card>

      <Dialog open={setOptionDialogOpen} onOpenChange={handleSetOptionDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t(isSetChildOptionDialog ? "product.manageSetChildOptions" : "product.addSetProductOption")}
            </DialogTitle>
            <DialogDescription>
              {t(isSetChildOptionDialog ? "product.setChildOptionMasterHint" : "product.setProductOptionHint")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <FieldSet>
              <FieldLegend>
                {editingSetOptionUuid ? t("settings.editRecord") : t("settings.newRecord")}
              </FieldLegend>
              <FieldDescription>{t("product.setProductOptionFormHint")}</FieldDescription>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="set-option-name-la">{t("fields.nameLa")}</FieldLabel>
                  <Input
                    id="set-option-name-la"
                    value={setOptionNameLa}
                    disabled={setOptionSaving}
                    autoComplete="off"
                    onChange={(event) => setSetOptionNameLa(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="set-option-name-eng">{t("fields.nameEn")}</FieldLabel>
                  <Input
                    id="set-option-name-eng"
                    value={setOptionNameEng}
                    disabled={setOptionSaving}
                    autoComplete="off"
                    onChange={(event) => setSetOptionNameEng(event.target.value)}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend>{setOptionListTitle}</FieldLegend>
              <FieldDescription>
                {t("common.total")}:{" "}
                {isSetChildOptionDialog ? setChildOptionOptions.length : setOptionOptions.length} ·{" "}
                {t("common.selectedCount", {
                  count: isSetChildOptionDialog
                    ? details.reduce(
                        (total, row) =>
                          total + row.set_option_groups.filter((group) => group.set_child_option_uuid_fk).length,
                        0,
                      )
                    : details.filter((row) => row.size_uuid_fk).length,
                })}
              </FieldDescription>
              <InputGroup>
                <InputGroupInput
                  value={setOptionSearch}
                  placeholder={t("product.searchSetProductOptions")}
                  aria-label={t("product.searchSetProductOptions")}
                  onChange={(event) => setSetOptionSearch(event.target.value)}
                />
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
              </InputGroup>
              <ItemGroup className="max-h-80 overflow-y-auto">
                {filteredSetOptionOptions.map((option) => {
                  const uuid = option.uuid;
                  const label = language.startsWith("en")
                    ? option.nameEng || option.nameLa || option.name
                    : option.nameLa || option.nameEng || option.name;
                  const selected = isSetChildOptionDialog
                    ? details.some((row) =>
                        row.set_option_groups.some((group) => group.set_child_option_uuid_fk === uuid),
                      )
                    : details.some((row) => row.size_uuid_fk === uuid);
                  const editing = editingSetOptionUuid === uuid;

                  return (
                    <Item key={uuid} size="sm" variant={editing || selected ? "muted" : "outline"}>
                      <ItemContent>
                        <ItemTitle>{label}</ItemTitle>
                        <ItemDescription>{option.nameEng || t("fields.nameEn")}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        {selected ? <Badge variant="secondary">{t("common.active")}</Badge> : null}
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("actions.edit")}
                          disabled={setOptionSaving}
                          onClick={() => editSetOption(option)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("actions.delete")}
                          disabled={setOptionSaving}
                          onClick={() => setDeletingSetOptionUuid(uuid)}
                        >
                          <Trash2 />
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
              {!filteredSetOptionOptions.length ? (
                <FieldDescription>{t("common.noData")}</FieldDescription>
              ) : null}
            </FieldSet>
          </div>
          <DialogFooter>
            {editingSetOptionUuid ? (
              <Button type="button" variant="outline" disabled={setOptionSaving} onClick={resetSetOptionForm}>
                <RefreshCcw data-icon="inline-start" />
                {t("actions.new")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={setOptionSaving}
              onClick={() => handleSetOptionDialogOpen(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={setOptionSaving || !setOptionNameLa.trim()}
              onClick={saveSetOptionFromDialog}
            >
              {setOptionSaving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deletingSetOptionUuid)}
        title={`${t("actions.delete")} ${setOptionListTitle}`}
        description={t("settings.deleteConfirm")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={setOptionSaving}
        onConfirm={() => void deleteSetOptionFromDialog(deletingSetOptionUuid)}
        onOpenChange={(open) => {
          if (!open) setDeletingSetOptionUuid("");
        }}
      />
    </>
  );
}
