"use client";

import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { SettingsImageCropPanel } from "@/features/settings/shared/settings-image-crop";
import {
  CUSTOM_COLOR_VALUE,
  DEFAULT_COLOR,
  PRODUCT_FORM_FIELD_IDS as FIELD_IDS,
  colorCode,
  colorLabel,
  isHexColor,
} from "./product-form-utils";
import { ProductFormChoiceGroup } from "./product-form-choice-group";
import type { ProductFormWorkflow } from "./use-product-form-workflow";

export function ProductFormImageSection({ form }: { form: ProductFormWorkflow }) {
  const {
    t,
    imageModeChoices,
    prodStatusImge,
    setProdStatusImge,
    existingSrc,
    selectedImage,
    setSelectedImage,
    crop,
    setCrop,
    colorValue,
    setColorValue,
    colorChoice,
    setColorChoice,
    validColors,
    colors,
    saving,
    invalidFieldIds,
  } = form;
  const colorInvalid = invalidFieldIds.has(FIELD_IDS.color);

  return (
    <Card id={FIELD_IDS.imageSection}>
      <CardHeader>
        <CardTitle>{t("product.sections.image")}</CardTitle>
        <CardDescription>{t("product.sections.imageHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <ProductFormChoiceGroup
            id="prod-image-mode"
            legend={t("product.imageMode")}
            className="sm:grid-cols-2"
            choices={imageModeChoices}
            value={prodStatusImge}
            onValueChange={setProdStatusImge}
          />

          {prodStatusImge === "1" ? (
            // The crop panel is shared with settings, where it is a sidebar; here it
            // sits inside the card, so give it its own rounded outline instead.
            <SettingsImageCropPanel
              className="rounded-md border md:border"
              crop={crop}
              description={t("settings.storeBranch.cropHint")}
              emptyLabel={t("fields.prod_image")}
              existingSrc={existingSrc}
              fileSupportText={t("settings.storeBranch.imageSupport")}
              fieldId="prod-image"
              previewMaxClassName="max-w-44 sm:max-w-52"
              removeLabel={t("settings.storeBranch.cancelImage")}
              saving={saving}
              selectedFile={selectedImage}
              title={t("settings.storeBranch.cropImage")}
              uploadLabel={t("settings.storeBranch.uploadImage")}
              zoomLabel={t("settings.storeBranch.zoom")}
              onCropChange={setCrop}
              onFileChange={setSelectedImage}
            />
          ) : (
            <>
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
                  <SelectTrigger id="prod-color-choice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {validColors.map((color) => {
                        const code = colorCode(color);
                        return (
                          <SelectItem key={color.color_uuid} value={color.color_uuid}>
                            {/* Swatch colour is user data from the API, not a theme token. */}
                            <span
                              className="size-3 rounded-full border"
                              style={{ backgroundColor: code }}
                            />
                            {colorLabel(color)}
                            <span className="text-muted-foreground">{code}</span>
                          </SelectItem>
                        );
                      })}
                      <SelectItem value={CUSTOM_COLOR_VALUE}>{t("settings.customFlag")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={colorInvalid}>
                <FieldLabel htmlFor={FIELD_IDS.color}>{t("fields.color_code")}</FieldLabel>
                <ButtonGroup>
                  <Input
                    id="prod-color-picker"
                    type="color"
                    aria-label={t("fields.color_code")}
                    className="max-w-12 p-1"
                    value={isHexColor(colorValue) ? colorValue : DEFAULT_COLOR}
                    onChange={(event) => {
                      setColorChoice(CUSTOM_COLOR_VALUE);
                      setColorValue(event.target.value);
                    }}
                  />
                  <Input
                    id={FIELD_IDS.color}
                    aria-invalid={colorInvalid}
                    placeholder="#000000"
                    value={colorValue}
                    onChange={(event) => {
                      setColorChoice(CUSTOM_COLOR_VALUE);
                      setColorValue(event.target.value);
                    }}
                  />
                </ButtonGroup>
              </Field>
            </>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
