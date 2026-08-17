"use client";

import { useEffect, useRef, useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Crop, ImageIcon, ImagePlus, RotateCcw, X, ZoomIn } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
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
// ให้ซูมออกได้ไกลกว่าจุด "เห็นภาพเต็มพอดีกรอบ" อีกครึ่งหนึ่ง เผื่อผู้ใช้อยากเว้นขอบขาวรอบรูปเพิ่ม
const MIN_ZOOM_OUT_FACTOR = 0.5;

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

// ผู้ใช้ที่ไม่เปิดกล่องตัดรูปเลย (หรือเปิดแล้วไม่ปรับอะไร) ต้องได้รูปที่ใช้งานได้ — ให้เห็นภาพเต็มใบ
// กึ่งกลางกรอบเสมอ ตรงกับที่ตัวครอปเองก็เปิดมาแบบเห็นภาพเต็มเป็นค่าเริ่มต้น (ดู getContainZoom ด้านล่าง)
// กรอบที่คำนวณได้จึงอาจ "ใหญ่กว่า" ตัวรูปจริงในมิติใดมิติหนึ่ง (x/y ติดลบได้) — canvas drawImage
// รองรับ source rect ที่เกินขอบภาพตามสเปกอยู่แล้ว ส่วนที่เกินจะไม่ถูกวาด เหลือพื้นขาวที่ fill ไว้ก่อน
export function containCropArea(image: Pick<HTMLImageElement, "naturalHeight" | "naturalWidth">, aspect: number): CropArea {
  const { naturalHeight, naturalWidth } = image;
  const imageAspect = naturalWidth / naturalHeight;

  if (imageAspect > aspect) {
    const height = naturalWidth / aspect;
    return { width: naturalWidth, height, x: 0, y: (naturalHeight - height) / 2 };
  }

  const width = naturalHeight * aspect;
  return { width, height: naturalHeight, x: (naturalWidth - width) / 2, y: 0 };
}

// zoom ของ react-easy-crop เป็นตัวคูณบนฐาน "cover" ของตัวมันเอง (zoom=1 คือครอบเต็มกรอบเสมอ)
// ต้องการให้เปิดมาแล้ว "เห็นภาพเต็ม" (contain) จึงต้องคำนวณ zoom ที่ต่ำกว่า 1 เอง แล้วตั้งเป็นค่าเริ่มต้น
// (การซูมออกไกลกว่านี้อีกยังมีประโยชน์ — เว้นขอบขาวรอบรูปเพิ่ม ดู MIN_ZOOM_OUT_FACTOR)
export function getContainZoom(mediaAspect: number, aspect: number) {
  return Math.min(aspect / mediaAspect, mediaAspect / aspect);
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

  const area = crop.areaPixels ?? containCropArea(image, aspect);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputWidth, outputHeight);

  return canvasToFile(canvas, file, "crop");
}

// ย่อรูปให้กรอบที่เลือกไว้พอดีกับกล่องตัวอย่าง แล้วเลื่อนจุดเริ่มไปที่มุมของกรอบ
// ใช้ค่าเปอร์เซ็นต์ชุดเดียวกับที่ cropper คืนมา รูปตัวอย่างจึงตรงกับไฟล์ที่จะบันทึกเสมอ
function cropPreviewStyle(src: string, area: CropArea | null): CSSProperties | undefined {
  if (!src) return undefined;
  if (!area) return { backgroundImage: `url("${src}")`, backgroundPosition: "center", backgroundSize: "cover" };

  // area กว้าง/สูงเกิน 100% ได้เมื่อเป็นกรอบแบบเห็นภาพเต็ม (กรอบใหญ่กว่าตัวรูป) — กรณีนั้น
  // ไม่มีพื้นที่ให้เลื่อน ต้องกึ่งกลางเสมอ ไม่ใช่ชิดซ้าย/บนแบบตอน area เท่ากับ 100% พอดี
  const positionX = area.width < 100 ? `${(area.x / (100 - area.width)) * 100}%` : "50%";
  const positionY = area.height < 100 ? `${(area.y / (100 - area.height)) * 100}%` : "50%";

  return {
    backgroundImage: `url("${src}")`,
    backgroundPosition: `${positionX} ${positionY}`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${area.width > 0 ? 10000 / area.width : 100}% ${area.height > 0 ? 10000 / area.height : 100}%`
  };
}

function ImageCropDialog({
  aspect,
  cropShape,
  onConfirm,
  onOpenChange,
  onSave,
  open,
  src,
  title,
  value,
  zoomLabel
}: {
  aspect: number;
  cropShape: "rect" | "round";
  onConfirm: (crop: CropState) => void;
  onOpenChange: (open: boolean) => void;
  onSave?: (crop: CropState) => Promise<void> | void;
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
          cropShape={cropShape}
          src={src}
          title={title}
          value={value}
          zoomLabel={zoomLabel}
          onCancel={() => onOpenChange(false)}
          onConfirm={(next) => {
            onConfirm(next);
            onOpenChange(false);
          }}
          onSave={onSave}
        />
      </DialogContent>
    </Dialog>
  );
}

function ImageCropDialogBody({
  aspect,
  cropShape,
  onCancel,
  onConfirm,
  onSave,
  src,
  title,
  value,
  zoomLabel
}: {
  aspect: number;
  cropShape: "rect" | "round";
  onCancel: () => void;
  onConfirm: (crop: CropState) => void;
  onSave?: (crop: CropState) => Promise<void> | void;
  src: string;
  title: string;
  value: CropState;
  zoomLabel: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CropState>(value);
  const [submitting, setSubmitting] = useState(false);
  // fitZoom = ซูมที่เห็นภาพเต็มพอดีกรอบ (ค่าเริ่มต้น และค่าที่ปุ่ม "รีเซ็ต" กลับไปหา)
  // minZoom = ซูมออกได้ไกลกว่านั้นอีกหน่อย เผื่อผู้ใช้อยากเว้นขอบขาวรอบรูปเพิ่มเอง
  const [fitZoom, setFitZoom] = useState(MIN_ZOOM);
  const [minZoom, setMinZoom] = useState(MIN_ZOOM);

  // เปิดกล่องมาแล้วเห็นภาพเต็มใบก่อนเสมอ (ไม่ซูมครอบเต็มกรอบให้อัตโนมัติแบบเดิม) ผู้ใช้ค่อยซูม/ลากเพื่อ
  // ครอปเองถ้าต้องการ — คำนวณ zoom ที่ "เห็นภาพเต็ม" ได้ก็ต่อเมื่อรู้ขนาดจริงของรูป จึงต้องรอ media โหลดเสร็จ
  // ถ้าเคยครอปรูปนี้มาก่อนแล้ว (areaPixels มีค่า) ให้เคารพตำแหน่ง/ซูมเดิม ไม่รีเซ็ตทับ
  function handleMediaLoaded(mediaSize: MediaSize) {
    const containZoom = getContainZoom(mediaSize.naturalWidth / mediaSize.naturalHeight, aspect);
    setFitZoom(containZoom);
    setMinZoom(containZoom * MIN_ZOOM_OUT_FACTOR);
    if (!value.areaPixels) {
      setDraft((current) => ({ ...current, zoom: containZoom }));
    }
  }

  function resetCrop() {
    setDraft({ x: 0, y: 0, zoom: fitZoom, areaPixels: null, areaPercent: null });
  }

  // เมื่อมี onSave ปุ่มนี้คือปุ่มบันทึกจริง (อัปโหลดเข้าเซิร์ฟเวอร์) ไม่ใช่แค่ยืนยันค่าครอปแล้วปิดกล่อง
  // ถ้าอัปโหลดพลาด ให้กล่องเปิดค้างไว้ (caller เป็นคน toast error เอง) ไม่ปิดเหมือนสำเร็จ
  async function handleSaveClick() {
    if (!onSave) {
      onConfirm(draft);
      return;
    }
    setSubmitting(true);
    try {
      await onSave(draft);
      onConfirm(draft);
    } catch {
      // stay open on failure
    } finally {
      setSubmitting(false);
    }
  }

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
          cropShape={cropShape}
          image={src}
          maxZoom={MAX_ZOOM}
          minZoom={minZoom}
          // react-easy-crop เองบังคับพื้นที่ที่รายงานผ่าน onCropComplete ไม่ให้เกิน 100% ของรูปเสมอเมื่อเปิดค่านี้
          // (default ของไลบรารี) — ที่ zoom >= 1 ไม่มีผลเพราะพื้นที่คำนวณได้ไม่เกิน 100% อยู่แล้ว แต่ที่ zoom < 1
          // (โหมดเห็นภาพเต็ม) พื้นที่จริงต้องเกินตัวรูป (ถูก letterbox) ถ้าปล่อยให้ clamp จะได้พื้นที่แบบครอบเต็ม
          // กรอบ (cover) กลับมาแทน ไม่ตรงกับภาพที่เห็นในกล่องพรีวิว จึงต้องปิดเฉพาะช่วง zoom < 1
          restrictPosition={draft.zoom >= 1}
          showGrid
          zoom={draft.zoom}
          onCropChange={(point) => setDraft((current) => ({ ...current, x: point.x, y: point.y }))}
          onCropComplete={(areaPercent, areaPixels) =>
            setDraft((current) => ({ ...current, areaPercent, areaPixels }))
          }
          onMediaLoaded={handleMediaLoaded}
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
          min={minZoom}
          step={0.01}
          value={[draft.zoom]}
          onValueChange={(values) => setDraft((current) => ({ ...current, zoom: Number(values[0] ?? current.zoom) }))}
        />
      </Field>
      <DialogFooter>
        <Button
          className="min-h-11 sm:mr-auto sm:min-h-9"
          disabled={submitting}
          type="button"
          variant="ghost"
          onClick={resetCrop}
        >
          <RotateCcw data-icon="inline-start" />
          {t("actions.reset")}
        </Button>
        <Button className="min-h-11 sm:min-h-9" disabled={submitting} type="button" variant="outline" onClick={onCancel}>
          {t("actions.cancel")}
        </Button>
        <Button className="min-h-11 gap-2 sm:min-h-9" disabled={submitting} type="button" onClick={handleSaveClick}>
          {submitting ? <Spinner /> : null}
          {submitting ? t("common.processing") : t("actions.save")}
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
  onSave,
  previewShape = "square",
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
  onSave?: (crop: CropState) => Promise<void> | void;
  // "circle" ใช้กับรูปโปรไฟล์ผู้ใช้ — ให้กรอบพรีวิวตรงกับ Avatar วงกลมของ shadcn ที่ไปแสดงผลจริง (ดู AVATAR_CROP_ASPECT_CLASS)
  previewShape?: "square" | "circle";
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
            "mx-auto h-auto w-full overflow-hidden border border-border bg-background p-2 hover:bg-background disabled:opacity-100",
            previewShape === "circle" ? "rounded-full" : "rounded-xl",
            previewMaxClassName
          )}
          disabled={inputDisabled}
          onClick={handleOpenFileDialog}
        >
          <span
            className={cn(
              "grid w-full place-items-center overflow-hidden bg-muted",
              previewShape === "circle" ? "rounded-full" : "rounded-lg",
              aspectClass
            )}
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
          cropShape={previewShape === "circle" ? "round" : "rect"}
          open={cropOpen}
          src={objectUrl}
          title={title}
          value={crop}
          zoomLabel={zoomLabel}
          onConfirm={onCropChange}
          onOpenChange={setCropOpen}
          onSave={onSave}
        />
      ) : null}
    </aside>
  );
}
