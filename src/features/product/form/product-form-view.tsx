"use client";

import { Check, Package, PackagePlus, Plus, RefreshCcw, Save, X } from "lucide-react";
import Link from "next/link";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { SETTINGS_ACCENT } from "@/features/settings/shared/settings-tones";
import { cn } from "@/lib/utils";
import { CategoryFormDialog } from "@/features/settings/category/category-form-dialog";
import { OptionFormDialog } from "@/features/settings/shared/option-settings-page";
import type { BinaryFlag } from "./product-form-types";
import {
  ORDER_POINT_OPTIONS,
  PRODUCT_FORM_FIELD_IDS as FIELD_IDS,
  TOPPING_HAS,
  categoryUuid,
  entityLabel,
  generateProdCode,
  productCategoryName,
  productUnitName,
  unitUuid,
} from "./product-form-utils";
import { ProductFormChoiceGroup } from "./product-form-choice-group";
import { ProductFormDetailsSection } from "./product-form-details-section";
import { ProductFormImageSection } from "./product-form-image-section";
import { ProductFormTastesSection } from "./product-form-tastes-section";
import { ProductFormToppingsSection } from "./product-form-toppings-section";
import type { ProductFormWorkflow } from "./use-product-form-workflow";
import { ProductSectionTitle } from "./product-form-section-title";

export function ProductFormView({ form }: { form: ProductFormWorkflow }) {
  const {
    t,
    title,
    saveNotice,
    saveDisabled,
    saveButtonLabel,
    typeLabel,
    imageLabel,
    tasteCount,
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
    invalidFieldIds,
  } = form;
  const nameInvalid = invalidFieldIds.has(FIELD_IDS.nameLa);
  const categoryInvalid = invalidFieldIds.has(FIELD_IDS.category);
  const unitInvalid = invalidFieldIds.has(FIELD_IDS.unit);
  const setPriceInvalid = invalidFieldIds.has(FIELD_IDS.setPrice);

  const formId = "product-form";
  const saveButton = (
    <Button type="submit" form={formId} disabled={saveDisabled}>
      {saveNotice === "saved" ? (
        <Check data-icon="inline-start" />
      ) : saveDisabled ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <Save data-icon="inline-start" />
      )}
      {saveButtonLabel}
    </Button>
  );
  // Red, so leaving without saving never reads as the main action.
  const cancelLink = (
    <Link className={buttonVariants({ variant: "destructive" })} href="/products">
      <X data-icon="inline-start" />
      {t("actions.cancel")}
    </Link>
  );
  const statusText =
    saveNotice !== "idle" ? (
      <p role="status" aria-live="polite" className="text-muted-foreground">
        {saveNotice === "saving" ? t("product.saving") : t("product.savedNext")}
      </p>
    ) : null;

  return (
    // app shell จำกัดความกว้าง + padding ให้แล้ว — ไม่ซ้อน max-w/mx-auto อีกชั้น
    // จอ xl: ฟอร์มซ้าย + การ์ดสรุป/ปุ่มบันทึกค้างด้านขวา, จอเล็กกว่า: การ์ดสรุปอยู่บน + แผงปุ่มลอยด้านล่าง
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      {/* The page header: the theme-colour wash and solid icon tile of the settings pages. */}
      <Card
        className={cn(
          "ring-0 xl:sticky xl:top-[calc(var(--app-shell-header-height,4rem)+1.5rem)] xl:order-last",
          SETTINGS_ACCENT.wash,
        )}
      >
        <CardHeader className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm", SETTINGS_ACCENT.solid)}
          >
            <PackagePlus className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <CardTitle>
              <h1 className="text-lg font-semibold">{title}</h1>
            </CardTitle>
            <CardDescription>{t("product.formDescription")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge className={SETTINGS_ACCENT.soft}>{typeLabel}</Badge>
          <Badge className={SETTINGS_ACCENT.soft}>{imageLabel}</Badge>
          {tasteCount > 0 ? (
            <Badge className={SETTINGS_ACCENT.soft}>
              {t("product.tasteSelectedCount", { count: tasteCount })}
            </Badge>
          ) : null}
          {prodToppingStatus === TOPPING_HAS ? (
            <Badge className={SETTINGS_ACCENT.soft}>
              {t("common.selectedCount", { count: toppingCount })}
            </Badge>
          ) : null}
        </CardContent>
        <CardFooter className="hidden flex-col items-stretch gap-2 xl:flex">
          {statusText}
          {saveButton}
          {cancelLink}
        </CardFooter>
      </Card>

      {/* noValidate: native "required" popups would block submit before our toast + scroll-to-field runs. */}
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        <ProductFormImageSection form={form} />

        <Card>
          <CardHeader>
            <ProductSectionTitle icon={Package}>{t("product.sections.general")}</ProductSectionTitle>
            <CardDescription>{t("product.sections.generalHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <ProductFormChoiceGroup
                id="prod-type"
                legend={t("product.type")}
                className="sm:grid-cols-3"
                choices={productTypeChoices}
                value={statusSortFk}
                onValueChange={changeStatusSort}
              />
              <Field>
                <FieldLabel htmlFor="prod-code">{t("fields.code")}</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="prod-code" value={prodCode} readOnly required />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton onClick={() => setProdCode(generateProdCode())}>
                      <RefreshCcw data-icon="inline-start" />
                      {t("product.regenerateCode")}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <FieldGroup className="grid md:grid-cols-2">
                <Field data-invalid={nameInvalid}>
                  <FieldLabel htmlFor={FIELD_IDS.nameLa}>{t("fields.nameLa")}</FieldLabel>
                  <Input
                    id={FIELD_IDS.nameLa}
                    aria-invalid={nameInvalid}
                    value={prodNameLa}
                    onChange={(event) => setProdNameLa(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="prod-name-eng">{t("fields.nameEn")}</FieldLabel>
                  <Input
                    id="prod-name-eng"
                    value={prodNameEng}
                    onChange={(event) => setProdNameEng(event.target.value)}
                  />
                </Field>
                <Field data-invalid={categoryInvalid}>
                  <FieldLabel htmlFor={FIELD_IDS.category}>{t("nav.category")}</FieldLabel>
                  <ButtonGroup>
                    <Select
                      key={categoryOptions.length ? "ready" : "loading"}
                      value={cateUuidFk}
                      onValueChange={setCateUuidFk}
                    >
                      <SelectTrigger id={FIELD_IDS.category} aria-invalid={categoryInvalid} className="flex-1">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`${t("actions.add")} ${t("nav.category")}`}
                      disabled={categorySaving}
                      onClick={() => setCategoryDialogOpen(true)}
                    >
                      <Plus />
                    </Button>
                  </ButtonGroup>
                </Field>
                <Field data-invalid={unitInvalid}>
                  <FieldLabel htmlFor={FIELD_IDS.unit}>{t("nav.unit")}</FieldLabel>
                  <ButtonGroup>
                    <Select
                      key={unitOptions.length ? "ready" : "loading"}
                      value={uniteUuidFk}
                      onValueChange={setUniteUuidFk}
                    >
                      <SelectTrigger id={FIELD_IDS.unit} aria-invalid={unitInvalid} className="flex-1">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`${t("actions.add")} ${t("nav.unit")}`}
                      disabled={unitSaving}
                      onClick={() => setUnitDialogOpen(true)}
                    >
                      <Plus />
                    </Button>
                  </ButtonGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="prod-order-point">{t("product.orderPoint")}</FieldLabel>
                  <Select value={prodOrderPoint} onValueChange={setProdOrderPoint}>
                    <SelectTrigger id="prod-order-point">
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
                  <FieldLabel htmlFor="prod-notification">
                    {t("product.notification.label")}
                  </FieldLabel>
                  <Select
                    value={prodNotification}
                    onValueChange={(value) => setProdNotification(value as BinaryFlag)}
                  >
                    <SelectTrigger id="prod-notification">
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
              </FieldGroup>
              {statusSortFk === "2" ? (
                <Field data-invalid={setPriceInvalid}>
                  <FieldLabel htmlFor={FIELD_IDS.setPrice}>{t("product.setPrice")}</FieldLabel>
                  <FormattedNumberInput
                    id={FIELD_IDS.setPrice}
                    aria-invalid={setPriceInvalid}
                    placeholder="0"
                    min={1}
                    value={prodSetPrice}
                    onValueChange={setProdSetPrice}
                  />
                </Field>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        <ProductFormTastesSection form={form} />

        <ProductFormDetailsSection form={form} />

        <ProductFormToppingsSection form={form} />

        {/* แผงปุ่มลอยเป็น Card ของตัวเอง (ไม่ใช่แถบตัดทับการ์ดเนื้อหา) — ฟอร์มยาวเกือบ 2 จอ ปุ่มบันทึกต้องเห็นตลอด
            bottom บวกความสูง bottom nav ของ Android ที่ fixed ทับอยู่ (เว็บไม่มีตัวแปรนี้ = 0) */}
        <Card
          size="sm"
          className="sticky bottom-[calc(1rem+var(--app-shell-bottom-nav-height,0px))] shadow-lg xl:hidden"
        >
          <CardContent className="flex flex-wrap items-center justify-end gap-2">
            <div className="mr-auto">{statusText}</div>
            {cancelLink}
            {saveButton}
          </CardContent>
        </Card>
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
