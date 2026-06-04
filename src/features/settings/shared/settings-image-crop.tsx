"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Crop, ImageIcon, ImagePlus, MoveHorizontal, MoveVertical, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type CropState = {
  x: number;
  y: number;
  zoom: number;
};

export const DEFAULT_CROP: CropState = { x: 50, y: 50, zoom: 1 };

function fileExtension(type: string) {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

function loadImage(file: File, errorMessage: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(errorMessage));
    };
    image.src = url;
  });
}

export async function cropImageFile(file: File, crop: CropState, imageLoadFailed: string) {
  const image = await loadImage(file, imageLoadFailed);
  const side = 512;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d");
  if (!context) return file;

  const baseScale = Math.max(side / image.naturalWidth, side / image.naturalHeight) * crop.zoom;
  const renderedWidth = image.naturalWidth * baseScale;
  const renderedHeight = image.naturalHeight * baseScale;
  const left = (side - renderedWidth) * (crop.x / 100);
  const top = (side - renderedHeight) * (crop.y / 100);
  const sourceX = Math.max(0, -left / baseScale);
  const sourceY = Math.max(0, -top / baseScale);
  const sourceSize = Math.min(image.naturalWidth - sourceX, image.naturalHeight - sourceY, side / baseScale);
  const outputType = file.type || "image/jpeg";

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, side, side);
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, side, side);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.92));
  if (!blob) return file;

  const extension = fileExtension(outputType);
  const basename = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${basename}-crop.${extension}`, { type: outputType });
}

function CropRange({
  disabled,
  icon,
  label,
  max,
  min,
  onChange,
  step = 1,
  value
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <Field className="gap-2" data-disabled={disabled ? "true" : undefined}>
      <FieldLabel className="text-xs font-black text-muted-foreground">
        {icon}
        {label}
      </FieldLabel>
      <Slider
        disabled={disabled}
        max={max}
        min={min}
        step={step}
        value={[value]}
        onValueChange={(values) => onChange(Number(values[0] ?? value))}
      />
    </Field>
  );
}

export function SettingsImageCropPanel({
  crop,
  description,
  disabled,
  emptyLabel,
  existingSrc,
  fieldId,
  horizontalLabel,
  onCropChange,
  onFileChange,
  saving,
  selectedFile,
  fileSupportText,
  removeLabel,
  className,
  previewMaxClassName = "max-w-56 sm:max-w-none",
  sideBorderAt = "md",
  title,
  uploadLabel,
  verticalLabel,
  zoomLabel
}: {
  crop: CropState;
  description: string;
  disabled?: boolean;
  emptyLabel: string;
  existingSrc: string;
  fieldId?: string;
  horizontalLabel: string;
  onCropChange: (crop: CropState) => void;
  onFileChange: (file: File | null) => void;
  saving: boolean;
  selectedFile: File | null;
  fileSupportText: string;
  removeLabel: string;
  className?: string;
  previewMaxClassName?: string;
  sideBorderAt?: "md" | "lg";
  title: string;
  uploadLabel: string;
  verticalLabel: string;
  zoomLabel: string;
}) {
  const [previewSrc, setPreviewSrc] = useState(existingSrc);
  const inputDisabled = Boolean(disabled || saving);
  const cropDisabled = inputDisabled || !selectedFile;
  const sideBorderClass = sideBorderAt === "lg" ? "lg:border-b-0 lg:border-r" : "md:border-b-0 md:border-r";
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewSrc(existingSrc);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [existingSrc, selectedFile]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    onCropChange(DEFAULT_CROP);
    onFileChange(file);
  }

  function handleOpenFileDialog() {
    fileInputRef.current?.click();
  }

  function handleRemoveImage() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    onCropChange(DEFAULT_CROP);
    onFileChange(null);
  }

  return (
    <aside className={cn("flex min-h-0 flex-col gap-4 border-b border-border bg-muted/20 p-4", sideBorderClass, className)}>
      <FieldSet className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <FieldLegend className="mb-1 text-sm font-black">{title}</FieldLegend>
            <FieldDescription className="text-xs">{description}</FieldDescription>
          </div>
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Crop className="size-4" />
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          aria-label={uploadLabel}
          className={cn(
            "mx-auto h-auto w-full overflow-hidden rounded-xl border border-border bg-background p-2 hover:bg-background disabled:opacity-100",
            previewMaxClassName
          )}
          disabled={inputDisabled}
          onClick={handleOpenFileDialog}
        >
          <span
            className="grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-muted bg-cover bg-center"
            style={
              previewSrc
                ? {
                    backgroundImage: `url("${previewSrc}")`,
                    backgroundPosition: `${crop.x}% ${crop.y}%`,
                    backgroundSize: `${Math.round(100 * crop.zoom)}% auto`
                  }
                : undefined
            }
          >
            {!previewSrc ? <ImageIcon className="size-8 text-muted-foreground" /> : null}
            <span className="sr-only">{emptyLabel}</span>
          </span>
        </Button>

        <FieldGroup className="gap-4">
          <Field className="gap-2">
            <Button type="button" variant="outline" className="w-full" disabled={inputDisabled} onClick={handleOpenFileDialog}>
              <ImagePlus className="size-4" />
              {uploadLabel}
            </Button>
            <Input
              ref={fileInputRef}
              id={fieldId}
              className="sr-only"
              disabled={inputDisabled}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              onChange={handleFileChange}
            />
            <FieldDescription>{fileSupportText}</FieldDescription>
          </Field>

          {selectedFile ? (
            <>
              <Button type="button" variant="outline" className="w-full" disabled={inputDisabled} onClick={handleRemoveImage}>
                <X className="size-4" />
                {removeLabel}
              </Button>
              <FieldGroup className="gap-4 rounded-lg border border-border bg-card p-3">
                <CropRange
                  disabled={cropDisabled}
                  icon={<ZoomIn className="size-3.5" />}
                  label={zoomLabel}
                  max={2.5}
                  min={1}
                  step={0.05}
                  value={crop.zoom}
                  onChange={(zoom) => onCropChange({ ...crop, zoom })}
                />
                <CropRange
                  disabled={cropDisabled}
                  icon={<MoveHorizontal className="size-3.5" />}
                  label={horizontalLabel}
                  max={100}
                  min={0}
                  value={crop.x}
                  onChange={(x) => onCropChange({ ...crop, x })}
                />
                <CropRange
                  disabled={cropDisabled}
                  icon={<MoveVertical className="size-3.5" />}
                  label={verticalLabel}
                  max={100}
                  min={0}
                  value={crop.y}
                  onChange={(y) => onCropChange({ ...crop, y })}
                />
              </FieldGroup>
            </>
          ) : null}
        </FieldGroup>
      </FieldSet>
    </aside>
  );
}
