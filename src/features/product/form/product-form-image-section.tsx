"use client";

import { useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { Check, ImageIcon, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IMAGE_CROP_ASPECT_CLASS } from "@/config/image-crop";
import { SettingsImageCropPanel } from "@/features/settings/shared/settings-image-crop";
import { cn } from "@/lib/utils";
import type { ImageFitMode } from "./product-form-types";
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

// แท็บ "ไม่ครอบตัด" ไม่มีกล่อง Cropper — จัดการไฟล์เองแบบง่าย ๆ (เลือกไฟล์ + พรีวิว + เอาออก)
function ProductImageContainPanel({
  existingSrc,
  imageSupportText,
  removeLabel,
  saving,
  selectedImage,
  setSelectedImage,
  title,
  uploadLabel,
}: {
  existingSrc: string;
  imageSupportText: string;
  removeLabel: string;
  saving: boolean;
  selectedImage: File | null;
  setSelectedImage: (file: File | null) => void;
  title: string;
  uploadLabel: string;
}) {
  const objectUrl = useMemo(() => (selectedImage ? URL.createObjectURL(selectedImage) : ""), [selectedImage]);
  const previewSrc = objectUrl || existingSrc;
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedImage(event.target.files?.[0] ?? null);
  }

  function handleRemove() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedImage(null);
  }

  return (
    <aside className="flex min-h-0 flex-col gap-4 border-b border-border bg-muted/20 p-4 md:border-r md:border-b-0">
      <FieldSet className="gap-4">
        <FieldLegend className="mb-1 text-sm font-black">{title}</FieldLegend>

        <Button
          type="button"
          variant="ghost"
          aria-label={uploadLabel}
          className="mx-auto h-auto w-full max-w-44 overflow-hidden rounded-xl border border-border bg-background p-2 hover:bg-background disabled:opacity-100 sm:max-w-52"
          disabled={saving}
          onClick={() => fileInputRef.current?.click()}
        >
          <span
            className={cn(
              "grid w-full place-items-center overflow-hidden rounded-lg bg-muted bg-contain bg-center bg-no-repeat",
              IMAGE_CROP_ASPECT_CLASS
            )}
            style={previewSrc ? { backgroundImage: `url("${previewSrc}")` } : undefined}
          >
            {!previewSrc ? <ImageIcon className="size-8 text-muted-foreground" /> : null}
          </span>
        </Button>

        <FieldGroup className="gap-4">
          <Field className="gap-2">
            <Button type="button" variant="outline" className="w-full" disabled={saving} onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="size-4" />
              {uploadLabel}
            </Button>
            <Input
              ref={fileInputRef}
              id="prod-image-contain"
              className="sr-only"
              disabled={saving}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              onChange={handleFileChange}
            />
            <FieldDescription>{imageSupportText}</FieldDescription>
          </Field>

          {selectedImage ? (
            <Button type="button" variant="outline" disabled={saving} onClick={handleRemove}>
              <X className="size-4" />
              <span className="truncate">{removeLabel}</span>
            </Button>
          ) : null}
        </FieldGroup>
      </FieldSet>
    </aside>
  );
}

export function ProductFormImageSection({ form }: { form: ProductFormWorkflow }) {
  const {
    t,
    imageModeChoices,
    prodStatusImge,
    setProdStatusImge,
    imageFitMode,
    setImageFitMode,
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
          <Tabs
            value={imageFitMode}
            onValueChange={(value) => setImageFitMode(value as ImageFitMode)}
          >
            <div className="flex flex-col gap-2 px-4 pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="crop">{t("product.imageFitMode.crop")}</TabsTrigger>
                <TabsTrigger value="contain">{t("product.imageFitMode.contain")}</TabsTrigger>
              </TabsList>
              <FieldDescription>
                {imageFitMode === "crop"
                  ? t("product.imageFitMode.cropHint")
                  : t("product.imageFitMode.containHint")}
              </FieldDescription>
            </div>
            <TabsContent value="crop">
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
            </TabsContent>
            <TabsContent value="contain">
              <ProductImageContainPanel
                existingSrc={existingSrc}
                imageSupportText={t("settings.storeBranch.imageSupport")}
                removeLabel={t("settings.storeBranch.cancelImage")}
                saving={saving}
                selectedImage={selectedImage}
                setSelectedImage={setSelectedImage}
                title={t("product.imageFitMode.contain")}
                uploadLabel={t("settings.storeBranch.uploadImage")}
              />
            </TabsContent>
          </Tabs>
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
