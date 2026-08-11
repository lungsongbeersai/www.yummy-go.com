"use client";

import { useCallback, useEffect, useMemo } from "react";
import { cropImageFile, type CropState } from "@/features/settings/shared/settings-image-crop";
import type { BinaryFlag } from "./product-form-types";

interface ProductImageWorkflowOptions {
  colorValue: string;
  crop: CropState;
  imageLoadFailedLabel: string;
  prodStatusImge: BinaryFlag;
  rawExistingImage: string;
  selectedImage: File | null;
}

export function useProductImageWorkflow({
  colorValue,
  crop,
  imageLoadFailedLabel,
  prodStatusImge,
  rawExistingImage,
  selectedImage
}: ProductImageWorkflowOptions) {
  // preview เดิมเป็น state ที่ sync ด้วย effect ทั้งที่ derive จากไฟล์ได้ตรง ๆ
  // effect เหลือหน้าที่คืนหน่วยความจำของ object URL เท่านั้น
  const selectedImagePreview = useMemo(
    () => (selectedImage ? URL.createObjectURL(selectedImage) : ""),
    [selectedImage]
  );

  useEffect(() => {
    if (!selectedImagePreview) return;
    return () => URL.revokeObjectURL(selectedImagePreview);
  }, [selectedImagePreview]);

  const productImagePayload = useCallback(async () => {
    if (prodStatusImge === "2") return colorValue;
    if (selectedImage) return cropImageFile(selectedImage, crop, imageLoadFailedLabel);
    return rawExistingImage && !rawExistingImage.startsWith("#") ? rawExistingImage : undefined;
  }, [colorValue, crop, imageLoadFailedLabel, prodStatusImge, rawExistingImage, selectedImage]);

  return { productImagePayload, selectedImagePreview };
}
