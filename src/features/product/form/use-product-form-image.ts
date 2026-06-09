"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [selectedImagePreview, setSelectedImagePreview] = useState("");

  useEffect(() => {
    if (!selectedImage) {
      setSelectedImagePreview("");
      return;
    }

    const url = URL.createObjectURL(selectedImage);
    setSelectedImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  const productImagePayload = useCallback(async () => {
    if (prodStatusImge === "2") return colorValue;
    if (selectedImage) return cropImageFile(selectedImage, crop, imageLoadFailedLabel);
    return rawExistingImage && !rawExistingImage.startsWith("#") ? rawExistingImage : undefined;
  }, [colorValue, crop, imageLoadFailedLabel, prodStatusImge, rawExistingImage, selectedImage]);

  return { productImagePayload, selectedImagePreview };
}
