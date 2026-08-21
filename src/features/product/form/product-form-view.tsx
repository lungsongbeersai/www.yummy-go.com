"use client";

import { Check, Plus, RefreshCcw, Save } from "lucide-react";
import { BackButton } from "@/components/common/back-button";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { CategoryFormDialog } from "@/features/settings/category/category-form-dialog";
import { OptionFormDialog } from "@/features/settings/shared/option-settings-page";
import type { BinaryFlag } from "./product-form-types";
import {
  ORDER_POINT_OPTIONS,
  TOPPING_HAS,
  categoryUuid,
  choiceCardClass,
  choiceMarkClass,
  entityLabel,
  generateProdCode,
  productCategoryName,
  productUnitName,
  unitUuid,
} from "./product-form-utils";
import { ProductFormDetailsSection } from "./product-form-details-section";
import { ProductFormImageSection } from "./product-form-image-section";
import { ProductFormSectionHeader } from "./product-form-section-header";
import { ProductFormToppingsSection } from "./product-form-toppings-section";
import type { ProductFormWorkflow } from "./use-product-form-workflow";

export function ProductFormView({ form }: { form: ProductFormWorkflow }) {
  const {
    t,
    title,
    saveNotice,
    saveDisabled,
    saveButtonLabel,
    typeLabel,
    imageLabel,
    toppingCount,
    categoryOptions,
    groupOptions,
    unitOptions,
    productTypeChoices,
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
    prodToppingStatus,
    categoryDialogOpen,
    setCategoryDialogOpen,
    unitDialogOpen,
    setUnitDialogOpen,
    sizeDialogOpen,
    setSizeDialogOpen,
    language,
    categorySaving,
    unitSaving,
    sizeSaving,
    submit,
    saveCategoryFromDialog,
    saveUnitFromDialog,
    saveSizeFromDialog,
    changeStatusSort,
  } = form;
  // ความสูงล็อกไว้เท่าปุ่ม size="xs" (h-7) พอดี — ป้ายกำกับในกริดแถวเดียวกันจึงตรงกัน
  // ไม่ว่าช่องไหนจะมีปุ่ม "+ เพิ่ม" หรือไม่ (เดิม min-h-8 สูงเกินปุ่มไป 4px ทุกแถว)
  const labelRowClass = "flex min-h-7 items-center justify-between gap-2";

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <BackButton fallbackHref="/products" label={t("product.title")} />
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t("product.formDescription")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{typeLabel}</Badge>
          <Badge>{imageLabel}</Badge>
          {prodToppingStatus === TOPPING_HAS ? (
            <Badge>{t("common.selectedCount", { count: toppingCount })}</Badge>
          ) : null}
        </div>
      </div>

      {saveNotice !== "idle" ? (
        <Alert
          role="status"
          aria-live="polite"
          className={cn(
            saveNotice === "saved" && "border-primary/30 bg-primary/5",
          )}
        >
          {saveNotice === "saving" ? (
            <Spinner role="presentation" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          <AlertDescription
            className={cn(
              "font-medium",
              saveNotice === "saved" && "text-primary",
            )}
          >
            {saveNotice === "saving"
              ? t("product.saving")
              : t("product.savedNext")}
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <ProductFormImageSection form={form} />

          <Card>
            <ProductFormSectionHeader
              number="2"
              title={t("product.sections.general")}
              hint={t("product.sections.generalHint")}
            />
            <CardContent>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="prod-type">
                    {t("product.type")}
                  </FieldLabel>
                  <div id="prod-type" className="grid gap-2 sm:grid-cols-3">
                    {productTypeChoices.map((choice) => {
                      const active = statusSortFk === choice.value;
                      return (
                        <Button
                          key={choice.value}
                          type="button"
                          variant="ghost"
                          className={choiceCardClass(active)}
                          aria-pressed={active}
                          onClick={() => changeStatusSort(choice.value)}
                        >
                          <span className={choiceMarkClass(active)}>
                            <Check className="size-3" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {choice.label}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                              {choice.hint}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </Field>
                <Field className="md:col-span-2">
                  <div className={labelRowClass}>
                    <FieldLabel htmlFor="prod-code">
                      {t("fields.code")}
                    </FieldLabel>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input id="prod-code" value={prodCode} readOnly required />
                    <Button
                      type="button"
                      size="default"
                      variant="outline"
                      onClick={() => setProdCode(generateProdCode())}
                    >
                      <RefreshCcw data-icon="inline-start" />
                      {t("product.regenerateCode")}
                    </Button>
                  </div>
                </Field>
                <Field>
                  <div className={labelRowClass}>
                    <FieldLabel htmlFor="prod-name-la">
                      {t("fields.nameLa")}
                    </FieldLabel>
                  </div>
                  <Input
                    id="prod-name-la"
                    value={prodNameLa}
                    onChange={(event) => setProdNameLa(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <div className={labelRowClass}>
                    <FieldLabel htmlFor="prod-name-eng">
                      {t("fields.nameEn")}
                    </FieldLabel>
                  </div>
                  <Input
                    id="prod-name-eng"
                    value={prodNameEng}
                    onChange={(event) => setProdNameEng(event.target.value)}
                  />
                </Field>
                <Field>
                  <div className={labelRowClass}>
                    <FieldLabel htmlFor="prod-category">
                      {t("nav.category")}
                    </FieldLabel>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={categorySaving}
                      onClick={() => setCategoryDialogOpen(true)}
                    >
                      <Plus data-icon="inline-start" />
                      {t("actions.add")}
                    </Button>
                  </div>
                  <Select
                    key={categoryOptions.length ? "ready" : "loading"}
                    value={cateUuidFk}
                    onValueChange={setCateUuidFk}
                  >
                    <SelectTrigger id="prod-category" className="w-full">
                      <SelectValue placeholder={t("nav.category")} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {categoryOptions.map((category) => {
                          const uuid = categoryUuid(category);
                          return (
                            <SelectItem key={uuid} value={uuid}>
                              {entityLabel(
                                category,
                                "cate_name_eng",
                                "cate_name_la",
                                language,
                                productCategoryName(category) || uuid,
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <div className={labelRowClass}>
                    <FieldLabel htmlFor="prod-unit">{t("nav.unit")}</FieldLabel>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={unitSaving}
                      onClick={() => setUnitDialogOpen(true)}
                    >
                      <Plus data-icon="inline-start" />
                      {t("actions.add")}
                    </Button>
                  </div>
                  <Select
                    key={unitOptions.length ? "ready" : "loading"}
                    value={uniteUuidFk}
                    onValueChange={setUniteUuidFk}
                  >
                    <SelectTrigger id="prod-unit" className="w-full">
                      <SelectValue placeholder={t("nav.unit")} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {unitOptions.map((unit) => {
                          const uuid = unitUuid(unit);
                          return (
                            <SelectItem key={uuid} value={uuid}>
                              {entityLabel(
                                unit,
                                "unite_name_eng",
                                "unite_name_la",
                                language,
                                productUnitName(unit) || uuid,
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <div className={labelRowClass}>
                    <FieldLabel htmlFor="prod-order-point">
                      {t("product.orderPoint")}
                    </FieldLabel>
                  </div>
                  <Select
                    value={prodOrderPoint}
                    onValueChange={setProdOrderPoint}
                  >
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
                  <div className={labelRowClass}>
                    <FieldLabel htmlFor="prod-notification">
                      {t("product.notification.label")}
                    </FieldLabel>
                  </div>
                  <Select
                    value={prodNotification}
                    onValueChange={(value) =>
                      setProdNotification(value as BinaryFlag)
                    }
                  >
                    <SelectTrigger id="prod-notification" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="1">
                          {t("product.notification.on")}
                        </SelectItem>
                        <SelectItem value="2">
                          {t("product.notification.off")}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {statusSortFk === "2" ? (
                  <Field className="md:col-span-2">
                    <div className={labelRowClass}>
                      <FieldLabel htmlFor="prod-set-price">
                        {t("product.setPrice")}
                      </FieldLabel>
                    </div>
                    <FormattedNumberInput
                      id="prod-set-price"
                      min={0}
                      value={prodSetPrice}
                      onValueChange={setProdSetPrice}
                    />
                  </Field>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>

          <ProductFormDetailsSection form={form} />

          <ProductFormToppingsSection form={form} />

          {/* ฟอร์มยาว 5 ส่วน กรอกจบแล้วสายตาอยู่ล่างสุด จึงมีปุ่มบันทึกปิดท้ายทุกขนาดจอ
              ไม่ได้ซ้ำซ้อนกับปุ่มใน sidebar เพราะ sidebar โผล่เฉพาะ xl ขึ้นไป */}
          <div className="flex justify-end">
            <Button type="submit" disabled={saveDisabled} className="max-sm:w-full">
              {saveNotice === "saved" ? (
                <Check data-icon="inline-start" />
              ) : saveDisabled ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {saveButtonLabel}
            </Button>
          </div>
        </div>
      </form>

      <CategoryFormDialog
        editing={null}
        groupOptions={groupOptions}
        open={categoryDialogOpen}
        saving={categorySaving}
        title={t("settings.modules.category.title")}
        onOpenChange={(open) => {
          if (!categorySaving) setCategoryDialogOpen(open);
        }}
        onSubmit={saveCategoryFromDialog}
      />
      <OptionFormDialog
        description={t("settings.unitFormHint")}
        editing={null}
        fields={[
          {
            name: "unite_name_la",
            label: t("fields.unite_name_la"),
            required: true,
            fallbackKey: "unite_name",
          },
          { name: "unite_name_eng", label: t("fields.unite_name_eng") },
        ]}
        formTitle={t("settings.unitDetails")}
        idKey="unite_uuid"
        open={unitDialogOpen}
        saving={unitSaving}
        slug="unit"
        title={t("settings.modules.unit.title")}
        onOpenChange={(open) => {
          if (!unitSaving) setUnitDialogOpen(open);
        }}
        onSubmit={saveUnitFromDialog}
      />
      <OptionFormDialog
        description={t("settings.sizeFormHint")}
        editing={null}
        fields={[
          {
            name: "size_name_la",
            label: t("fields.size_name_la"),
            required: true,
            fallbackKey: "size_name",
          },
          { name: "size_name_eng", label: t("fields.size_name_eng") },
        ]}
        formTitle={t("settings.sizeDetails")}
        idKey="size_uuid"
        open={sizeDialogOpen}
        saving={sizeSaving}
        slug="size"
        title={t("settings.modules.size.title")}
        onOpenChange={(open) => {
          if (!sizeSaving) setSizeDialogOpen(open);
        }}
        onSubmit={saveSizeFromDialog}
      />
    </div>
  );
}
