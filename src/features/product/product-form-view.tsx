"use client";

import { Bell, Check, ImageIcon, Layers3, RefreshCcw, Save, Utensils } from "lucide-react";
import { BackButton } from "@/components/common/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
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
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { SettingsImageCropPanel } from "@/features/settings/settings-image-crop";
import type { BinaryFlag } from "./product-form-types";
import {
  CUSTOM_COLOR_VALUE,
  DEFAULT_COLOR,
  ORDER_POINT_OPTIONS,
  TOPPING_HAS,
  categoryUuid,
  choiceCardClass,
  choiceMarkClass,
  colorCode,
  colorLabel,
  entityLabel,
  generateProdCode,
  isHexColor,
  productCategoryName,
  productUnitName,
  unitUuid,
} from "./product-form-utils";
import { ProductFormDetailsSection } from "./product-form-details-section";
import { ProductFormSectionNumber } from "./product-form-section-number";
import { ProductFormToppingsSection } from "./product-form-toppings-section";
import type { ProductFormWorkflow } from "./use-product-form-workflow";

export function ProductFormView({ form }: { form: ProductFormWorkflow }) {
  const {
    t,
    title,
    saveDisabled,
    saveButtonLabel,
    existingSrc,
    previewSrc,
    typeLabel,
    imageLabel,
    toppingCount,
    validColors,
    categoryOptions,
    unitOptions,
    productTypeChoices,
    imageModeChoices,
    requiredChecks,
    completedChecks,
    readyToSave,
    prodCode,
    setProdCode,
    prodNameLa,
    setProdNameLa,
    prodNameEng,
    setProdNameEng,
    cateUuidFk,
    setCateUuidFk,
    uniteUuidFk,
    setUniteUuidFk,
    prodOrderPoint,
    setProdOrderPoint,
    prodNotification,
    setProdNotification,
    statusSortFk,
    prodSetPrice,
    setProdSetPrice,
    prodStatusImge,
    setProdStatusImge,
    selectedImage,
    setSelectedImage,
    crop,
    setCrop,
    colorValue,
    setColorValue,
    colorChoice,
    setColorChoice,
    prodToppingStatus,
    language,
    saving,
    colors,
    submit,
    changeStatusSort,
  } = form;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <BackButton fallbackHref="/product" label={t("product.title")} />
          <h1 className="mt-2 text-2xl font-black">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("product.formDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{typeLabel}</Badge>
          <Badge>{imageLabel}</Badge>
          {prodToppingStatus === TOPPING_HAS ? <Badge>{t("common.selectedCount", { count: toppingCount })}</Badge> : null}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="grid gap-4 xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]"
      >
        <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader className="flex-col items-start">
              <CardTitle>{t("product.formSummary")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("product.formSummaryHint")}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div
                className="mx-auto grid size-40 max-w-full place-items-center overflow-hidden rounded-md border border-border bg-muted bg-cover bg-center sm:size-44"
                style={
                  prodStatusImge === "2"
                    ? { backgroundColor: colorValue }
                    : previewSrc
                      ? { backgroundImage: `url("${previewSrc}")` }
                      : undefined
                }
              >
                {prodStatusImge === "1" && !previewSrc ? (
                  <ImageIcon className="size-10 text-muted-foreground" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black">{prodNameLa || prodNameEng || title}</p>
                <p className="truncate text-xs font-semibold text-muted-foreground">{prodCode}</p>
              </div>
              <Badge className={cn("w-fit", readyToSave && "border-primary/30 bg-primary/10 text-primary")}>
                {readyToSave
                  ? t("product.readyToSave")
                  : t("product.needRequiredFields", { completed: completedChecks, total: requiredChecks.length })}
              </Badge>
              <Separator />
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Layers3 className="size-4" />
                    {t("product.type")}
                  </span>
                  <span className="font-semibold">{typeLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Bell className="size-4" />
                    {t("product.notification.label")}
                  </span>
                  <span className="font-semibold">
                    {prodNotification === "1" ? t("product.notification.on") : t("product.notification.off")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Utensils className="size-4" />
                    {t("product.sections.toppings")}
                  </span>
                  <span className="font-semibold">
                    {prodToppingStatus === TOPPING_HAS ? toppingCount : t("product.topping.no")}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <p className="text-xs font-black uppercase text-muted-foreground">
                  {t("product.quickCheck")}
                </p>
                <div className="grid gap-1.5">
                  {requiredChecks.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-full border",
                          item.done ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"
                        )}
                      >
                        <Check className="size-3" />
                      </span>
                      <span className={cn("truncate", item.done ? "text-foreground" : "text-muted-foreground")}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={saveDisabled} className="w-full">
                {saveDisabled ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                {saveButtonLabel}
              </Button>
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-start justify-start gap-3">
              <ProductFormSectionNumber value="1" />
              <div className="min-w-0">
                <CardTitle>{t("product.sections.general")}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{t("product.sections.generalHint")}</p>
              </div>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="prod-type">{t("product.type")}</FieldLabel>
                <div id="prod-type" className="grid gap-2 sm:grid-cols-3">
                  {productTypeChoices.map((choice) => {
                    const active = statusSortFk === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        className={choiceCardClass(active)}
                        aria-pressed={active}
                        onClick={() => changeStatusSort(choice.value)}
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
              <Field>
                <FieldLabel htmlFor="prod-code">{t("fields.code")}</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input id="prod-code" value={prodCode} readOnly required />
                  <Button type="button" size="md" variant="outline" onClick={() => setProdCode(generateProdCode())}>
                    <RefreshCcw data-icon="inline-start" />
                    {t("product.regenerateCode")}
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="prod-name-la">{t("fields.nameLa")}</FieldLabel>
                <Input id="prod-name-la" value={prodNameLa} onChange={(event) => setProdNameLa(event.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="prod-name-eng">{t("fields.nameEn")}</FieldLabel>
                <Input id="prod-name-eng" value={prodNameEng} onChange={(event) => setProdNameEng(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="prod-category">{t("nav.category")}</FieldLabel>
                <Select key={categoryOptions.length ? "ready" : "loading"} value={cateUuidFk} onValueChange={setCateUuidFk}>
                  <SelectTrigger id="prod-category" className="w-full">
                    <SelectValue placeholder={t("nav.category")} />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {categoryOptions.map((category) => {
                        const uuid = categoryUuid(category);
                        return (
                          <SelectItem key={uuid} value={uuid}>
                            {entityLabel(category, "cate_name_eng", "cate_name_la", language, productCategoryName(category) || uuid)}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="prod-unit">{t("nav.unit")}</FieldLabel>
                <Select key={unitOptions.length ? "ready" : "loading"} value={uniteUuidFk} onValueChange={setUniteUuidFk}>
                  <SelectTrigger id="prod-unit" className="w-full">
                    <SelectValue placeholder={t("nav.unit")} />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {unitOptions.map((unit) => {
                        const uuid = unitUuid(unit);
                        return (
                          <SelectItem key={uuid} value={uuid}>
                            {entityLabel(unit, "unite_name_eng", "unite_name_la", language, productUnitName(unit) || uuid)}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="prod-order-point">{t("product.orderPoint")}</FieldLabel>
                <Select value={prodOrderPoint} onValueChange={setProdOrderPoint}>
                  <SelectTrigger id="prod-order-point" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {ORDER_POINT_OPTIONS.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="prod-notification">{t("product.notification.label")}</FieldLabel>
                <Select value={prodNotification} onValueChange={(value) => setProdNotification(value as BinaryFlag)}>
                  <SelectTrigger id="prod-notification" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value="1">{t("product.notification.on")}</SelectItem>
                      <SelectItem value="2">{t("product.notification.off")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {statusSortFk === "2" ? (
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="prod-set-price">{t("product.setPrice")}</FieldLabel>
                  <Input
                    id="prod-set-price"
                    type="number"
                    min={0}
                    value={prodSetPrice}
                    onChange={(event) => setProdSetPrice(event.target.value)}
                  />
                </Field>
              ) : null}
            </FieldGroup>
          </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-start gap-3">
              <ProductFormSectionNumber value="2" />
              <div className="min-w-0">
                <CardTitle>{t("product.sections.image")}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{t("product.sections.imageHint")}</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col gap-4 p-4 lg:p-5">
              <Field>
                <FieldLabel>{t("product.imageMode")}</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {imageModeChoices.map((choice) => {
                    const active = prodStatusImge === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        className={choiceCardClass(active)}
                        aria-pressed={active}
                        onClick={() => setProdStatusImge(choice.value)}
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
              </div>
            {prodStatusImge === "1" ? (
              <SettingsImageCropPanel
                crop={crop}
                description={t("settings.storeBranch.cropHint")}
                emptyLabel={t("fields.prod_image")}
                existingSrc={existingSrc}
                fileSupportText={t("settings.storeBranch.imageSupport")}
                fieldId="prod-image"
                horizontalLabel={t("settings.storeBranch.horizontal")}
                previewMaxClassName="max-w-44 sm:max-w-52"
                removeLabel={t("settings.storeBranch.cancelImage")}
                saving={saving}
                selectedFile={selectedImage}
                title={t("settings.storeBranch.cropImage")}
                uploadLabel={t("settings.storeBranch.uploadImage")}
                verticalLabel={t("settings.storeBranch.vertical")}
                zoomLabel={t("settings.storeBranch.zoom")}
                onCropChange={setCrop}
                onFileChange={setSelectedImage}
              />
            ) : (
              <div className="flex flex-col gap-3 p-4 lg:p-5">
                <Field>
                  <FieldLabel htmlFor="prod-color-choice">{t("product.color")}</FieldLabel>
                  <Select
                    value={colorChoice}
                    onValueChange={(value) => {
                      setColorChoice(value);
                      if (value === CUSTOM_COLOR_VALUE) return;
                      const selected = colors.find((color) => color.color_uuid === value);
                      const code = selected ? colorCode(selected) : "";
                      if (code) setColorValue(code);
                    }}
                  >
                    <SelectTrigger id="prod-color-choice" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {validColors.map((color) => {
                          const code = colorCode(color);
                          return (
                            <SelectItem key={color.color_uuid} value={color.color_uuid}>
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="size-3 shrink-0 rounded-full border border-border"
                                  style={{ backgroundColor: code }}
                                />
                                <span className="truncate">{colorLabel(color)}</span>
                                <span className="text-muted-foreground">{code}</span>
                              </span>
                            </SelectItem>
                          );
                        })}
                        <SelectItem value={CUSTOM_COLOR_VALUE}>{t("settings.customFlag")}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="prod-color">{t("fields.color_code")}</FieldLabel>
                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                    <Input
                      id="prod-color-picker"
                      type="color"
                      className="size-10 shrink-0 cursor-pointer p-1"
                      value={isHexColor(colorValue) ? colorValue : DEFAULT_COLOR}
                      onChange={(event) => {
                        setColorChoice(CUSTOM_COLOR_VALUE);
                        setColorValue(event.target.value);
                      }}
                    />
                    <Input
                      id="prod-color"
                      placeholder="#000000"
                      value={colorValue}
                      onChange={(event) => {
                        setColorChoice(CUSTOM_COLOR_VALUE);
                        setColorValue(event.target.value);
                      }}
                    />
                  </div>
                </Field>
              </div>
            )}
          </CardContent>
          </Card>

          <ProductFormDetailsSection form={form} />

          <ProductFormToppingsSection form={form} />

          <div className="flex justify-end">
            <Button type="submit" disabled={saveDisabled}>
              {saveDisabled ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {saveButtonLabel}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
