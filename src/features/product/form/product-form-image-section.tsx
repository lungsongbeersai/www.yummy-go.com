"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
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
  choiceCardClass,
  choiceMarkClass,
  colorCode,
  colorLabel,
  isHexColor,
} from "./product-form-utils";
import { ProductFormSectionHeader } from "./product-form-section-header";
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
  } = form;

  return (
    <Card>
      <ProductFormSectionHeader
        number="1"
        title={t("product.sections.image")}
        hint={t("product.sections.imageHint")}
      />
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 p-4">
          <Field>
            <FieldLabel>{t("product.imageMode")}</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {imageModeChoices.map((choice) => {
                const active = prodStatusImge === choice.value;
                return (
                  <Button
                    key={choice.value}
                    type="button"
                    variant="ghost"
                    className={choiceCardClass(active)}
                    aria-pressed={active}
                    onClick={() => setProdStatusImge(choice.value)}
                  >
                    <span className={choiceMarkClass(active)}>
                      <Check className="size-3" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{choice.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{choice.hint}</span>
                    </span>
                  </Button>
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
          <div className="flex flex-col gap-4 p-4">
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
  );
}
