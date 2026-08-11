"use client";

import { useEffect, useRef, useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Crop, ImageIcon, ImagePlus, X, ZoomIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  IMAGE_CROP_ASPECT,
  IMAGE_CROP_ASPECT_CLASS,
  IMAGE_CROP_OUTPUT_HEIGHT,
  IMAGE_CROP_OUTPUT_WIDTH
} from "@/config/image-crop";
import { cn } from "@/lib/utils";

export type CropArea = Area;

export type CropState = {
  // ตำแหน่ง/ซูมของ cropper — เก็บไว้เพื่อให้เปิดกล่องซ้ำแล้วปรับต่อจากเดิมได้ ไม่ใช่เริ่มใหม่
  x: number;
  y: number;
  zoom: number;
  // areaPixels = พิกัดจริงบนรูปต้นฉบับ ใช้วาดลง canvas ตอนบันทึก
  // areaPercent = สัดส่วน ใช้คำนวณรูปตัวอย่างด้วย CSS ล้วน ไม่ต้องเข้ารหัสรูปใหม่
  // เก็บทั้งคู่เพราะรูปตัวอย่างกับผลลัพธ์จะได้มาจากตัวเลขชุดเดียวกัน (ของเดิมคำนวณคนละสูตรจนไม่ตรงกัน)
  areaPixels: CropArea | null;
  areaPercent: CropArea | null;
};

export const DEFAULT_CROP: CropState = { x: 0, y: 0, zoom: 1, areaPixels: null, areaPercent: null };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

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

// ผู้ใช้ที่ไม่เปิดกล่องตัดรูปเลยต้องได้รูปที่ใช้งานได้ — ตัดกรอบกลางภาพตามสัดส่วนมาตรฐานให้
function centerCropArea(image: HTMLImageElement, aspect: number): CropArea {
  const { naturalHeight, naturalWidth } = image;
  const wide = naturalWidth / naturalHeight > aspect;
  const width = wide ? naturalHeight * aspect : naturalWidth;
  const height = wide ? naturalHeight : naturalWidth / aspect;

  return {
    height,
    width,
    x: (naturalWidth - width) / 2,
    y: (naturalHeight - height) / 2
  };
}

async function canvasToFile(canvas: HTMLCanvasElement, sourceFile: File, suffix: string) {
  const outputType = sourceFile.type || "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.92));
  if (!blob) return sourceFile;

  const extension = fileExtension(outputType);
  const basename = sourceFile.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${basename}-${suffix}.${extension}`, { type: outputType });
}

export async function cropImageFile(
  file: File,
  crop: CropState,
  imageLoadFailed: string,
  options?: { aspect?: number; outputHeight?: number; outputWidth?: number }
) {
  const aspect = options?.aspect ?? IMAGE_CROP_ASPECT;
  const outputWidth = options?.outputWidth ?? IMAGE_CROP_OUTPUT_WIDTH;
  const outputHeight = options?.outputHeight ?? IMAGE_CROP_OUTPUT_HEIGHT;

  const image = await loadImage(file, imageLoadFailed);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) return file;

  const area = crop.areaPixels ?? centerCropArea(image, aspect);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputWidth, outputHeight);

  return canvasToFile(canvas, file, "crop");
}

// โหมด "ไม่ครอบตัด" — ย่อภาพทั้งใบให้พอดีกึ่งกลางกรอบ 4:3 แล้วเติมพื้นขาวรอบ ๆ แทนการซูม/ตัดขอบ
// วาดลง canvas ขนาดเดียวกับ cropImageFile เพื่อให้ผลลัพธ์เป็น 4:3 เสมอ จุดแสดงผลอื่นในระบบที่ใช้กรอบ 4:3 อยู่แล้วจึงไม่ต้องแก้อะไรเพิ่ม
export async function containImageFile(
  file: File,
  imageLoadFailed: string,
  options?: { outputHeight?: number; outputWidth?: number }
) {
  const outputWidth = options?.outputWidth ?? IMAGE_CROP_OUTPUT_WIDTH;
  const outputHeight = options?.outputHeight ?? IMAGE_CROP_OUTPUT_HEIGHT;

  const image = await loadImage(file, imageLoadFailed);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) return file;

  const scale = Math.min(outputWidth / image.naturalWidth, outputHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    (outputWidth - drawWidth) / 2,
    (outputHeight - drawHeight) / 2,
    drawWidth,
    drawHeight
  );

  return canvasToFile(canvas, file, "fit");
}

// ย่อรูปให้กรอบที่เลือกไว้พอดีกับกล่องตัวอย่าง แล้วเลื่อนจุดเริ่มไปที่มุมของกรอบ
// ใช้ค่าเปอร์เซ็นต์ชุดเดียวกับที่ cropper คืนมา รูปตัวอย่างจึงตรงกับไฟล์ที่จะบันทึกเสมอ
function cropPreviewStyle(src: string, area: CropArea | null): CSSProperties | undefined {
  if (!src) return undefined;
  if (!area) return { backgroundImage: `url("${src}")`, backgroundPosition: "center", backgroundSize: "cover" };

  return {
    backgroundImage: `url("${src}")`,
    backgroundPosition: `${area.width < 100 ? (area.x / (100 - area.width)) * 100 : 0}% ${
      area.height < 100 ? (area.y / (100 - area.height)) * 100 : 0
    }%`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${area.width > 0 ? 10000 / area.width : 100}% ${area.height > 0 ? 10000 / area.height : 100}%`
  };
}

function ImageCropDialog({
  aspect,
  onConfirm,
  onOpenChange,
  open,
  src,
  title,
  value,
  zoomLabel
}: {
  aspect: number;
  onConfirm: (crop: CropState) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  src: string;
  title: string;
  value: CropState;
  zoomLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-3 overflow-hidden p-4 sm:p-6">
        {/* เนื้อในแยกเป็นคอมโพเนนต์ของตัวเองเพราะ Radix ถอด portal ทิ้งตอนปิด
            การเปิดใหม่จึง mount ใหม่และหยิบค่าที่บันทึกไว้เป็นค่าตั้งต้นเอง ไม่ต้อง sync ด้วย effect */}
        <ImageCropDialogBody
          aspect={aspect}
          src={src}
          title={title}
          value={value}
          zoomLabel={zoomLabel}
          onCancel={() => onOpenChange(false)}
          onConfirm={(next) => {
            onConfirm(next);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function ImageCropDialogBody({
  aspect,
  onCancel,
  onConfirm,
  src,
  title,
  value,
  zoomLabel
}: {
  aspect: number;
  onCancel: () => void;
  onConfirm: (crop: CropState) => void;
  src: string;
  title: string;
  value: CropState;
  zoomLabel: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CropState>(value);

  return (
    <>
      <DialogHeader className="pr-10">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{t("settings.storeBranch.cropDragHint")}</DialogDescription>
      </DialogHeader>
      {/* ความสูงผูกกับ dvh — รูปกับตัวปรับจึงอยู่ในสายตาพร้อมกันเสมอ ไม่ว่าจอจะเตี้ยแค่ไหน */}
      <div className="relative h-[min(50dvh,20rem)] w-full shrink-0 overflow-hidden rounded-lg bg-black">
        <Cropper
          aspect={aspect}
          crop={{ x: draft.x, y: draft.y }}
          image={src}
          maxZoom={MAX_ZOOM}
          minZoom={MIN_ZOOM}
          showGrid
          zoom={draft.zoom}
          onCropChange={(point) => setDraft((current) => ({ ...current, x: point.x, y: point.y }))}
          onCropComplete={(areaPercent, areaPixels) =>
            setDraft((current) => ({ ...current, areaPercent, areaPixels }))
          }
          onZoomChange={(zoom) => setDraft((current) => ({ ...current, zoom }))}
        />
      </div>
      <Field className="gap-2">
        <FieldLabel className="text-xs font-medium text-muted-foreground">
          <ZoomIn className="size-3.5" />
          {zoomLabel}
        </FieldLabel>
        <Slider
          max={MAX_ZOOM}
          min={MIN_ZOOM}
          step={0.01}
          value={[draft.zoom]}
          onValueChange={(values) => setDraft((current) => ({ ...current, zoom: Number(values[0] ?? current.zoom) }))}
        />
      </Field>
      <DialogFooter>
        <Button className="min-h-11 sm:min-h-9" type="button" variant="outline" onClick={onCancel}>
          {t("actions.cancel")}
        </Button>
        <Button className="min-h-11 sm:min-h-9" type="button" onClick={() => onConfirm(draft)}>
          {t("actions.save")}
        </Button>
      </DialogFooter>
    </>
  );
}

export function SettingsImageCropPanel({
  aspect = IMAGE_CROP_ASPECT,
  aspectClass = IMAGE_CROP_ASPECT_CLASS,
  crop,
  description,
  disabled,
  emptyLabel,
  existingSrc,
  fieldId,
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
  zoomLabel
}: {
  aspect?: number;
  aspectClass?: string;
  crop: CropState;
  description: string;
  disabled?: boolean;
  emptyLabel: string;
  existingSrc: string;
  fieldId?: string;
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
  zoomLabel: string;
}) {
  // object URL ของไฟล์ที่เพิ่งเลือก ถ้ายังไม่เลือกก็ใช้รูปเดิมของเรคคอร์ด
  const objectUrl = useMemo(() => (selectedFile ? URL.createObjectURL(selectedFile) : ""), [selectedFile]);
  const previewSrc = objectUrl || existingSrc;
  const inputDisabled = Boolean(disabled || saving);
  const sideBorderClass = sideBorderAt === "lg" ? "lg:border-b-0 lg:border-r" : "md:border-b-0 md:border-r";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);

  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    onCropChange(DEFAULT_CROP);
    onFileChange(file);
    // เลือกไฟล์แล้วเข้าหน้าตัดรูปทันทีแบบเดียวกับแอปแชท — ไม่ต้องหาปุ่มเอง
    if (file) setCropOpen(true);
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
            className={cn("grid w-full place-items-center overflow-hidden rounded-lg bg-muted", aspectClass)}
            style={cropPreviewStyle(previewSrc, crop.areaPercent)}
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
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" disabled={inputDisabled} onClick={() => setCropOpen(true)}>
                <Crop className="size-4" />
                <span className="truncate">{title}</span>
              </Button>
              <Button type="button" variant="outline" disabled={inputDisabled} onClick={handleRemoveImage}>
                <X className="size-4" />
                <span className="truncate">{removeLabel}</span>
              </Button>
            </div>
          ) : null}
        </FieldGroup>
      </FieldSet>

      {selectedFile && objectUrl ? (
        <ImageCropDialog
          aspect={aspect}
          open={cropOpen}
          src={objectUrl}
          title={title}
          value={crop}
          zoomLabel={zoomLabel}
          onConfirm={onCropChange}
          onOpenChange={setCropOpen}
        />
      ) : null}
    </aside>
  );
}
