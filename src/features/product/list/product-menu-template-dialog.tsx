"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, FileText, RotateCcw, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { DEFAULT_MENU_BACKGROUND, DEFAULT_MENU_BACKGROUND_COLOR, normalizeMenuBackground, readMenuBackgroundImage, type ProductMenuBackground } from "./product-menu-background";
import { DEFAULT_MENU_HERO_PHOTO, type ProductMenuHeroPhoto } from "./product-menu-hero-photo";
import { ProductMenuTemplatePreview } from "./product-menu-surface";
import {
  DEFAULT_MENU_CATALOG_ROWS,
  DEFAULT_MENU_TEMPLATE_ID,
  getMenuTemplate,
  MENU_CATALOG_ROW_OPTIONS,
  MENU_CATALOG_TEMPLATES,
  type MenuCatalogTemplate,
  type MenuCatalogRows,
  type MenuTemplateId,
} from "./product-menu-templates";
import type { MenuCategory } from "./product-menu-utils";

const REFERENCE_TEMPLATE_IDS = new Set<MenuTemplateId>(["bistro", "editorial", "promo", "directory", "featured"]);
const BACKGROUND_MODES = ["template", "color", "image"] as const;
const HERO_PHOTO_MODES = ["auto", "product", "image"] as const;
const TEMPLATE_GROUPS = [
  { titleKey: "product.menuPdf.designer.newDesigns", templates: MENU_CATALOG_TEMPLATES.filter((template) => REFERENCE_TEMPLATE_IDS.has(template.id)) },
  { titleKey: "product.menuPdf.designer.originalDesigns", templates: MENU_CATALOG_TEMPLATES.filter((template) => !REFERENCE_TEMPLATE_IDS.has(template.id)) },
];

export interface ProductMenuTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  photoProgress?: { completed: number; total: number } | null;
  error: string | null;
  categories: MenuCategory[];
  images: Readonly<Record<string, string>>;
  onRetry: () => void;
  onDownload: (templateId: MenuTemplateId, rows: MenuCatalogRows, background: ProductMenuBackground, heroPhoto: ProductMenuHeroPhoto, photoOverrides: Readonly<Record<string, string>>) => void;
  downloading: boolean;
}

function TemplateLoadingCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">
      {MENU_CATALOG_TEMPLATES.map((template) => (
        <div key={template.id} className="flex flex-col gap-3 rounded-xl border p-2">
          <Skeleton className="aspect-[210/297] w-full rounded-md" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ProductMenuTemplateDialog({
  open,
  onOpenChange,
  loading,
  photoProgress,
  error,
  categories,
  images,
  onRetry,
  onDownload,
  downloading,
}: ProductMenuTemplateDialogProps) {
  const { t } = useTranslation();
  const choiceId = useId();
  const [selectedId, setSelectedId] = useState<MenuTemplateId>(DEFAULT_MENU_TEMPLATE_ID);
  const [selectedRows, setSelectedRows] = useState<MenuCatalogRows>(DEFAULT_MENU_CATALOG_ROWS);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [background, setBackground] = useState<ProductMenuBackground>(DEFAULT_MENU_BACKGROUND);
  const [backgroundMode, setBackgroundMode] = useState<ProductMenuBackground["mode"]>("template");
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_MENU_BACKGROUND_COLOR);
  const [backgroundImage, setBackgroundImage] = useState<{ image: string; filename: string } | null>(null);
  const [backgroundPreparing, setBackgroundPreparing] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [heroPhoto, setHeroPhoto] = useState<ProductMenuHeroPhoto>(DEFAULT_MENU_HERO_PHOTO);
  const [heroPhotoMode, setHeroPhotoMode] = useState<ProductMenuHeroPhoto["mode"]>("auto");
  const [heroProductId, setHeroProductId] = useState("");
  const [heroImage, setHeroImage] = useState<{ image: string; filename: string } | null>(null);
  const [heroPreparing, setHeroPreparing] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [photoOverrides, setPhotoOverrides] = useState<Record<string, string>>({});
  const [selectedDishId, setSelectedDishId] = useState("");
  const [dishPreparing, setDishPreparing] = useState(false);
  const [dishError, setDishError] = useState<string | null>(null);
  const backgroundUploadRequest = useRef(0);
  const heroUploadRequest = useRef(0);
  const dishUploadRequest = useRef(0);
  const dishImageInput = useRef<HTMLInputElement>(null);
  const heroImageInput = useRef<HTMLInputElement>(null);
  const backgroundImageInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    backgroundUploadRequest.current += 1;
    heroUploadRequest.current += 1;
    dishUploadRequest.current += 1;
  }, [open]);
  useEffect(() => () => { dishUploadRequest.current += 1; }, [categories]);
  useResetOnChange(categories, () => {
    setPhotoOverrides({});
    setDishPreparing(false);
    setDishError(null);
  });
  useResetOnChange(open, () => {
    setPhotoOverrides({});
    setDishPreparing(false);
    setDishError(null);
    if (!open) {
      setBackgroundPreparing(false);
      setBackgroundError(null);
      setHeroPreparing(false);
      setHeroError(null);
    }
  });
  const previewCategoryId = categories.some((category) => category.id === selectedCategoryId)
    ? selectedCategoryId : categories[0]?.id;
  const selected = getMenuTemplate(selectedId);
  const products = categories.flatMap((category) => category.items);
  const effectiveImages = useMemo(() => ({ ...images, ...photoOverrides }), [images, photoOverrides]);
  const photoProducts = products.flatMap((item) => {
    const image = effectiveImages[item.originalId ?? item.id];
    return typeof image === "string" && image ? [{ item, image }] : [];
  });
  const selectedDish = products.find((item) => item.id === selectedDishId) ?? products[0];
  const selectedDishKey = selectedDish?.originalId ?? selectedDish?.id ?? "";
  const selectedDishImage = effectiveImages[selectedDishKey];
  const hasDishOverride = Object.hasOwn(photoOverrides, selectedDishKey);
  const selectedHeroProduct = photoProducts.find(({ item }) => item.id === heroProductId) ?? photoProducts[0];
  const effectiveHeroPhoto: ProductMenuHeroPhoto = heroPhotoMode === "product" && selectedHeroProduct
    ? { mode: "product", productId: selectedHeroProduct.item.id } : heroPhoto;
  const busy = loading || downloading;
  const normalizedColor = normalizeMenuBackground({ mode: "color", color: backgroundColor });
  const colorInvalid = backgroundMode === "color" && normalizedColor.mode !== "color";
  const menuReady = !loading && !error && products.length > 0;
  const ready = menuReady && !backgroundPreparing && !heroPreparing && !dishPreparing && !colorInvalid &&
    (backgroundMode !== "image" || backgroundImage !== null) &&
    (heroPhotoMode !== "image" || heroImage !== null) &&
    (heroPhotoMode !== "product" || selectedHeroProduct !== undefined);
  const automaticRows = selected.layout === "directory" || selected.layout === "bistro";
  const stylesHeadingId = `${choiceId}-styles`;

  function layoutLabel(template: MenuCatalogTemplate) {
    const key = template.layout === "editorial" ? "product.menuPdf.designer.editorialLayout"
      : template.layout === "directory" ? "product.menuPdf.designer.directoryLayout"
        : template.layout === "bistro" ? "product.menuPdf.designer.bistroLayout" : "product.menuPdf.designer.layout";
    return t(key, { columns: template.columns, rows: selectedRows });
  }

  function changeBackgroundMode(value: string) {
    if (value !== "template" && value !== "color" && value !== "image") return;
    backgroundUploadRequest.current += 1;
    setBackgroundPreparing(false);
    setBackgroundError(null);
    setBackgroundMode(value);
    if (value === "template") setBackground(DEFAULT_MENU_BACKGROUND);
    if (value === "color") {
      const color = normalizeMenuBackground({ mode: "color", color: backgroundColor });
      if (color.mode === "color") setBackground(color);
      else {
        setBackgroundColor(DEFAULT_MENU_BACKGROUND_COLOR);
        setBackground({ mode: "color", color: DEFAULT_MENU_BACKGROUND_COLOR });
      }
    }
    if (value === "image" && backgroundImage) setBackground({ mode: "image", image: backgroundImage.image });
  }

  function changeBackgroundColor(value: string) {
    setBackgroundColor(value);
    const color = normalizeMenuBackground({ mode: "color", color: value });
    if (color.mode === "color") setBackground(color);
  }

  function closeDialog() {
    backgroundUploadRequest.current += 1;
    heroUploadRequest.current += 1;
    dishUploadRequest.current += 1;
    setBackgroundPreparing(false);
    setHeroPreparing(false);
    setDishPreparing(false);
    onOpenChange(false);
  }

  async function prepareBackgroundImage(file: File) {
    const request = ++backgroundUploadRequest.current;
    setBackgroundPreparing(true);
    setBackgroundError(null);
    try {
      const image = await readMenuBackgroundImage(file);
      if (request !== backgroundUploadRequest.current) return;
      setBackgroundImage({ image, filename: file.name });
      setBackground({ mode: "image", image });
      setBackgroundMode("image");
    } catch (error) {
      if (request !== backgroundUploadRequest.current) return;
      const code = error instanceof Error ? error.message : "";
      const key = code === "MENU_BACKGROUND_TYPE" ? "typeError" : code === "MENU_BACKGROUND_SIZE" ? "sizeError" : "decodeError";
      setBackgroundError(t(`product.menuPdf.designer.background.${key}`));
      setBackgroundMode(background.mode);
    } finally {
      if (request === backgroundUploadRequest.current) setBackgroundPreparing(false);
    }
  }

  function removeBackgroundImage() {
    backgroundUploadRequest.current += 1;
    setBackgroundPreparing(false);
    setBackgroundError(null);
    setBackgroundImage(null);
    setBackgroundMode("template");
    setBackground(DEFAULT_MENU_BACKGROUND);
  }

  function changeHeroPhotoMode(value: string) {
    if (value !== "auto" && value !== "product" && value !== "image") return;
    heroUploadRequest.current += 1;
    setHeroPreparing(false);
    setHeroError(null);
    setHeroPhotoMode(value);
    if (value === "auto") setHeroPhoto(DEFAULT_MENU_HERO_PHOTO);
    if (value === "product" && selectedHeroProduct) {
      setHeroProductId(selectedHeroProduct.item.id);
      setHeroPhoto({ mode: "product", productId: selectedHeroProduct.item.id });
    }
    if (value === "image" && heroImage) setHeroPhoto({ mode: "image", image: heroImage.image });
  }

  function changeHeroProduct(productId: string) {
    if (!photoProducts.some(({ item }) => item.id === productId)) return;
    setHeroProductId(productId);
    setHeroPhoto({ mode: "product", productId });
  }

  async function prepareHeroImage(file: File) {
    const request = ++heroUploadRequest.current;
    setHeroPreparing(true);
    setHeroError(null);
    try {
      const image = await readMenuBackgroundImage(file);
      if (request !== heroUploadRequest.current) return;
      setHeroImage({ image, filename: file.name });
      setHeroPhoto({ mode: "image", image });
      setHeroPhotoMode("image");
    } catch (error) {
      if (request !== heroUploadRequest.current) return;
      const code = error instanceof Error ? error.message : "";
      const key = code === "MENU_BACKGROUND_TYPE" ? "typeError" : code === "MENU_BACKGROUND_SIZE" ? "sizeError" : "decodeError";
      setHeroError(t(`product.menuPdf.designer.heroPhoto.${key}`));
      setHeroPhotoMode(heroPhoto.mode);
    } finally {
      if (request === heroUploadRequest.current) setHeroPreparing(false);
    }
  }

  function removeHeroImage() {
    heroUploadRequest.current += 1;
    setHeroPreparing(false);
    setHeroError(null);
    setHeroImage(null);
    setHeroPhotoMode("auto");
    setHeroPhoto(DEFAULT_MENU_HERO_PHOTO);
  }

  function changeSelectedDish(productId: string) {
    dishUploadRequest.current += 1;
    setDishPreparing(false);
    setDishError(null);
    setSelectedDishId(productId);
  }

  async function prepareDishImage(file: File) {
    if (!selectedDishKey) return;
    const productId = selectedDishKey;
    const request = ++dishUploadRequest.current;
    setDishPreparing(true);
    setDishError(null);
    try {
      const image = await readMenuBackgroundImage(file);
      if (request !== dishUploadRequest.current) return;
      setPhotoOverrides((current) => ({ ...current, [productId]: image }));
    } catch (error) {
      if (request !== dishUploadRequest.current) return;
      const code = error instanceof Error ? error.message : "";
      const key = code === "MENU_BACKGROUND_TYPE" ? "typeError" : code === "MENU_BACKGROUND_SIZE" ? "sizeError" : "decodeError";
      setDishError(t(`product.menuPdf.designer.dishPhotos.${key}`));
    } finally {
      if (request === dishUploadRequest.current) setDishPreparing(false);
    }
  }

  function resetDishImage() {
    dishUploadRequest.current += 1;
    setDishPreparing(false);
    setDishError(null);
    setPhotoOverrides((current) => {
      const next = { ...current };
      delete next[selectedDishKey];
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!downloading) { if (nextOpen) onOpenChange(true); else closeDialog(); } }}>
      <DialogContent
        className="font-lao flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
        showCloseButton={!downloading}
        onEscapeKeyDown={(event) => { if (downloading) event.preventDefault(); }}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle>{t("product.menuPdf.designer.title")}</DialogTitle>
          <DialogDescription>{t("product.menuPdf.designer.description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <div className="p-4 sm:p-6">
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>{t("product.menuPdf.failed")}</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-3">
                  <p>{error}</p>
                  <Button type="button" variant="outline" className="min-h-11" onClick={onRetry} disabled={busy}>
                    <RotateCcw data-icon="inline-start" />
                    {t("product.menuPdf.designer.retry")}
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : !loading && !products.length ? (
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Utensils /></EmptyMedia>
                <EmptyTitle>{t("product.menuPdf.errors.empty")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid items-start gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-6">
              <div className="grid gap-4 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor={`${choiceId}-rows`}>{t(selected.layout === "editorial" ? "product.menuPdf.designer.photoRowsLabel" : "product.menuPdf.designer.rowsLabel")}</Label>
                  <Select
                    value={String(selectedRows)}
                    disabled={busy || automaticRows}
                    onValueChange={(value) => {
                      const rows = Number(value);
                      if (rows === 4 || rows === 5 || rows === 6) setSelectedRows(rows);
                    }}
                  >
                    <SelectTrigger id={`${choiceId}-rows`} className="min-h-11 w-full">
                      <SelectValue>{automaticRows ? t("product.menuPdf.designer.automaticRows") : undefined}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {MENU_CATALOG_ROW_OPTIONS.map((rows) => <SelectItem key={rows} value={String(rows)} className="min-h-11">
                          {t("product.menuPdf.designer.rowsOption", { count: rows })}
                        </SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor={`${choiceId}-category`}>{t("product.menuPdf.designer.categoryLabel")}</Label>
                  <Select value={previewCategoryId ?? ""} disabled={!menuReady || busy} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger id={`${choiceId}-category`} className="min-h-11 w-full"><SelectValue placeholder={t("product.menuPdf.designer.categoryLabel")} /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>{categories.map((category) => <SelectItem key={category.id} value={category.id} className="min-h-11">
                        {category.name}
                      </SelectItem>)}</SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-w-0 flex-col gap-3 border-t pt-3 sm:col-span-2">
                  <h3 className="text-xs font-semibold">{t("product.menuPdf.designer.dishPhotos.title")}</h3>
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor={`${choiceId}-dish-photo-product`}>{t("product.menuPdf.designer.dishPhotos.dishLabel")}</Label>
                    <Select value={selectedDish?.id ?? ""} onValueChange={changeSelectedDish} disabled={!menuReady || downloading}>
                      <SelectTrigger id={`${choiceId}-dish-photo-product`} className="min-h-11 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>{products.map((item) => {
                          const image = effectiveImages[item.originalId ?? item.id];
                          const hasPhoto = typeof image === "string" && Boolean(image);
                          return <SelectItem key={item.id} value={item.id} className="min-h-11 pr-8">
                            {hasPhoto ? <Image src={image} alt="" width={32} height={32} unoptimized className="size-8 shrink-0 rounded object-cover" /> : null}
                            <span className="flex min-w-0 flex-col">
                              <span>{item.name}</span>
                              <span className="text-[0.625rem] text-muted-foreground">{item.categoryName}{hasPhoto ? "" : ` · ${t("product.menuPdf.noPhoto")}`}</span>
                            </span>
                          </SelectItem>;
                        })}</SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-w-0 items-start gap-3">
                    {typeof selectedDishImage === "string" && selectedDishImage ? <Image src={selectedDishImage} alt="" width={80} height={80} unoptimized className="size-20 shrink-0 rounded-md object-cover" />
                      : <p className="flex min-h-20 w-20 shrink-0 items-center justify-center rounded-md border px-2 text-center text-xs text-muted-foreground">{t("product.menuPdf.noPhoto")}</p>}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Label htmlFor={`${choiceId}-dish-photo-file`}>{t("product.menuPdf.designer.dishPhotos.upload")}</Label>
                      <Input
                        id={`${choiceId}-dish-photo-file`}
                        ref={dishImageInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={!menuReady || downloading || dishPreparing}
                        aria-describedby={`${choiceId}-dish-photo-help`}
                        className="sr-only size-px border-0 p-0"
                        tabIndex={-1}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          if (file) void prepareDishImage(file);
                        }}
                      />
                      <Button type="button" variant="outline" className="min-h-11 self-start" disabled={!menuReady || downloading || dishPreparing} onClick={() => dishImageInput.current?.click()}>
                        {t("product.menuPdf.designer.chooseImage")}
                      </Button>
                      {hasDishOverride ? <Button id={`${choiceId}-dish-photo-reset`} type="button" variant="outline" className="min-h-11 self-start" disabled={downloading} onClick={resetDishImage}>
                        {t("product.menuPdf.designer.dishPhotos.reset")}
                      </Button> : null}
                    </div>
                  </div>
                  <p id={`${choiceId}-dish-photo-help`} className="text-xs text-muted-foreground">{t("product.menuPdf.designer.dishPhotos.fileHelp")}</p>
                  <p className="text-xs text-muted-foreground">{t("product.menuPdf.designer.dishPhotos.scope")}</p>
                  {dishPreparing ? <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Spinner aria-hidden="true" />{t("product.menuPdf.designer.dishPhotos.preparing")}</p> : null}
                  {dishError ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{dishError}</AlertDescription></Alert> : null}
                </div>

                <div className="flex min-w-0 flex-col gap-3 border-t pt-3 sm:col-span-2">
                  <h3 id={`${choiceId}-hero-photo`} className="text-xs font-semibold">{t("product.menuPdf.designer.heroPhoto.title")}</h3>
                  <RadioGroup
                    aria-labelledby={`${choiceId}-hero-photo`}
                    value={heroPhotoMode}
                    onValueChange={changeHeroPhotoMode}
                    disabled={downloading}
                    className="grid grid-cols-3 gap-2"
                  >
                    {HERO_PHOTO_MODES.map((mode) => <Label
                      key={mode}
                      htmlFor={`${choiceId}-hero-photo-${mode}`}
                      className={cn(
                        "min-h-11 cursor-pointer justify-center gap-2 rounded-md border bg-card px-2 py-2 text-center",
                        heroPhotoMode === mode && "border-primary bg-primary/5",
                        mode === "product" && (!menuReady || !photoProducts.length) && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <RadioGroupItem id={`${choiceId}-hero-photo-${mode}`} value={mode} disabled={downloading || (mode === "product" && (!menuReady || !photoProducts.length))} />
                      {t(`product.menuPdf.designer.heroPhoto.${mode}`)}
                    </Label>)}
                  </RadioGroup>

                  {heroPhotoMode === "product" ? <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor={`${choiceId}-hero-product`}>{t("product.menuPdf.designer.heroPhoto.dishLabel")}</Label>
                    <Select value={selectedHeroProduct?.item.id ?? ""} onValueChange={changeHeroProduct} disabled={!menuReady || downloading}>
                      <SelectTrigger id={`${choiceId}-hero-product`} className="min-h-11 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>{photoProducts.map(({ item, image }) => <SelectItem key={item.id} value={item.id} className="min-h-11 pr-8">
                          <Image src={image} alt="" width={32} height={32} unoptimized className="size-8 shrink-0 rounded object-cover" />
                          <span className="flex min-w-0 flex-col">
                            <span>{item.name}</span>
                            <span className="text-[0.625rem] text-muted-foreground">{item.categoryName}</span>
                          </span>
                        </SelectItem>)}</SelectGroup>
                      </SelectContent>
                    </Select>
                  </div> : null}

                  {heroPhotoMode === "image" ? <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor={`${choiceId}-hero-file`}>{t("product.menuPdf.designer.heroPhoto.upload")}</Label>
                    <Input
                      id={`${choiceId}-hero-file`}
                      ref={heroImageInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={downloading || heroPreparing}
                      aria-describedby={`${choiceId}-hero-file-help`}
                      className="sr-only size-px border-0 p-0"
                      tabIndex={-1}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void prepareHeroImage(file);
                      }}
                    />
                    <Button type="button" variant="outline" className="min-h-11 self-start" disabled={downloading || heroPreparing} onClick={() => heroImageInput.current?.click()}>
                      {t("product.menuPdf.designer.chooseImage")}
                    </Button>
                    <p id={`${choiceId}-hero-file-help`} className="text-xs text-muted-foreground">{t("product.menuPdf.designer.heroPhoto.fileHelp")}</p>
                    {heroImage ? <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-md border bg-card p-2">
                      <Image src={heroImage.image} alt="" width={48} height={48} unoptimized className="size-12 rounded object-cover" />
                      <span className="min-w-0 flex-1 break-all text-xs">{heroImage.filename}</span>
                      <Button type="button" variant="outline" className="min-h-11" disabled={downloading} onClick={removeHeroImage}>
                        {t("product.menuPdf.designer.heroPhoto.remove")}
                      </Button>
                    </div> : null}
                  </div> : null}
                  {!loading && !photoProducts.length && heroPhotoMode !== "image" ? <p className="text-xs text-muted-foreground">{t("product.menuPdf.designer.heroPhoto.noDishPhotos")}</p> : null}
                  {heroPreparing ? <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Spinner aria-hidden="true" />{t("product.menuPdf.designer.heroPhoto.preparing")}</p> : null}
                  {heroError ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{heroError}</AlertDescription></Alert> : null}
                </div>

                <div className="flex min-w-0 flex-col gap-3 border-t pt-3 sm:col-span-2">
                  <h3 id={`${choiceId}-background`} className="text-xs font-semibold">{t("product.menuPdf.designer.background.title")}</h3>
                  <RadioGroup
                    aria-labelledby={`${choiceId}-background`}
                    value={backgroundMode}
                    onValueChange={changeBackgroundMode}
                    disabled={downloading}
                    className="grid grid-cols-3 gap-2"
                  >
                    {BACKGROUND_MODES.map((mode) => <Label
                      key={mode}
                      htmlFor={`${choiceId}-background-${mode}`}
                      className={cn("min-h-11 cursor-pointer justify-center gap-2 rounded-md border bg-card px-2 py-2 text-center", backgroundMode === mode && "border-primary bg-primary/5")}
                    >
                      <RadioGroupItem id={`${choiceId}-background-${mode}`} value={mode} />
                      {t(`product.menuPdf.designer.background.${mode}`)}
                    </Label>)}
                  </RadioGroup>

                  {backgroundMode === "color" ? <div className="flex flex-wrap items-start gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${choiceId}-background-color-picker`}>{t("product.menuPdf.designer.background.colorPicker")}</Label>
                      <Input
                        id={`${choiceId}-background-color-picker`}
                        type="color"
                        value={normalizedColor.mode === "color" ? normalizedColor.color : DEFAULT_MENU_BACKGROUND_COLOR}
                        disabled={downloading}
                        onChange={(event) => changeBackgroundColor(event.currentTarget.value)}
                        className="min-h-11 w-20 cursor-pointer p-1"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Label htmlFor={`${choiceId}-background-hex`}>{t("product.menuPdf.designer.background.hex")}</Label>
                      <Input
                        id={`${choiceId}-background-hex`}
                        type="text"
                        value={backgroundColor}
                        disabled={downloading}
                        aria-invalid={colorInvalid}
                        aria-describedby={colorInvalid ? `${choiceId}-background-hex-error` : undefined}
                        onChange={(event) => changeBackgroundColor(event.currentTarget.value)}
                        onBlur={() => { if (normalizedColor.mode === "color") setBackgroundColor(normalizedColor.color); }}
                        className="min-h-11 font-mono"
                        maxLength={7}
                      />
                      {colorInvalid ? <p id={`${choiceId}-background-hex-error`} className="text-xs text-destructive">{t("product.menuPdf.designer.background.hexError")}</p> : null}
                    </div>
                  </div> : null}

                  {backgroundMode === "image" ? <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor={`${choiceId}-background-file`}>{t("product.menuPdf.designer.background.upload")}</Label>
                    <Input
                      id={`${choiceId}-background-file`}
                      ref={backgroundImageInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={downloading || backgroundPreparing}
                      aria-describedby={`${choiceId}-background-file-help`}
                      className="sr-only size-px border-0 p-0"
                      tabIndex={-1}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void prepareBackgroundImage(file);
                      }}
                    />
                    <Button type="button" variant="outline" className="min-h-11 self-start" disabled={downloading || backgroundPreparing} onClick={() => backgroundImageInput.current?.click()}>
                      {t("product.menuPdf.designer.chooseImage")}
                    </Button>
                    <p id={`${choiceId}-background-file-help`} className="text-xs text-muted-foreground">{t("product.menuPdf.designer.background.fileHelp")}</p>
                    {backgroundImage ? <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border bg-card p-2">
                      <span className="min-w-0 flex-1 break-all text-xs">{backgroundImage.filename}</span>
                      <Button type="button" variant="outline" className="min-h-11" disabled={downloading} onClick={removeBackgroundImage}>
                        {t("product.menuPdf.designer.background.remove")}
                      </Button>
                    </div> : null}
                  </div> : null}
                  {backgroundPreparing ? <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Spinner aria-hidden="true" />{t("product.menuPdf.designer.background.preparing")}</p> : null}
                  {backgroundError ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{backgroundError}</AlertDescription></Alert> : null}
                </div>
              </div>
              <section className="flex min-w-0 flex-col gap-3" aria-busy={loading}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={stylesHeadingId} className="text-sm font-semibold">
                    {t("product.menuPdf.designer.selectStyle")}
                  </h3>
                  {!loading ? <Badge variant="secondary">{t("product.menuPdf.items", { count: products.length })}</Badge> : null}
                </div>

                {loading ? <TemplateLoadingCards /> : (
                  <RadioGroup
                    aria-labelledby={stylesHeadingId}
                    value={selectedId}
                    onValueChange={(value) => {
                      const template = MENU_CATALOG_TEMPLATES.find((entry) => entry.id === value);
                      if (template) setSelectedId(template.id);
                    }}
                    disabled={busy}
                    className="flex flex-col gap-5"
                  >
                    {TEMPLATE_GROUPS.map((group, groupIndex) => <div key={group.titleKey} className="flex min-w-0 flex-col gap-3" role="group" aria-labelledby={`${choiceId}-group-${groupIndex}`}>
                      <h4 id={`${choiceId}-group-${groupIndex}`} className="text-xs font-semibold text-muted-foreground">{t(group.titleKey)}</h4>
                      <div className={cn("grid grid-cols-2 gap-3", groupIndex === 1 && "sm:grid-cols-3")}>
                        {group.templates.map((template) => {
                      const id = `${choiceId}-${template.id}`;
                      return (
                        <div
                          key={template.id}
                          className={cn(
                            "relative min-w-0 rounded-xl border bg-card transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
                            selectedId === template.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50",
                            busy && "opacity-70",
                          )}
                        >
                          <RadioGroupItem id={id} value={template.id} aria-labelledby={`${id}-name`} className="absolute right-3 bottom-4 z-10" />
                          <label htmlFor={id} className={cn("flex flex-col gap-2 rounded-xl p-2", busy ? "cursor-wait" : "cursor-pointer")}>
                            <span className={cn("pointer-events-none mx-auto block aspect-[210/297] w-full overflow-hidden rounded-md border bg-background", groupIndex === 0 && "sm:max-w-44")} aria-hidden="true">
                              <ProductMenuTemplatePreview templateId={template.id} categories={categories} images={effectiveImages} rows={selectedRows} categoryId={previewCategoryId} background={background} heroPhoto={effectiveHeroPhoto} />
                            </span>
                            <span className="block min-h-10 pr-7 pl-1">
                              <span id={`${id}-name`} className="block text-xs font-semibold leading-relaxed">{t(template.nameKey)}</span>
                              <span className="block text-[0.625rem] leading-relaxed text-muted-foreground">
                                {layoutLabel(template)}
                              </span>
                            </span>
                          </label>
                        </div>
                      );
                        })}
                      </div>
                    </div>)}
                  </RadioGroup>
                )}

              </section>
              </div>

              <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-muted/30 p-3 sm:p-4 lg:sticky lg:top-0" aria-busy={loading}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{t("product.menuPdf.designer.preview")}</h3>
                  <Badge variant="outline">A4</Badge>
                </div>
                {loading ? <Skeleton className="aspect-[210/297] w-full rounded-md" /> : (
                  <div className="pointer-events-none aspect-[210/297] overflow-hidden rounded-md border bg-background shadow-md">
                    <ProductMenuTemplatePreview templateId={selectedId} categories={categories} images={effectiveImages} rows={selectedRows} categoryId={previewCategoryId} background={background} heroPhoto={effectiveHeroPhoto} />
                  </div>
                )}
                <div className="flex flex-col gap-1" aria-live="polite">
                  {loading ? <Skeleton className="h-4 w-1/2" /> : <p className="font-semibold">{t(selected.nameKey)}</p>}
                  {loading ? <Skeleton className="h-3 w-full" /> : <p className="text-xs leading-relaxed text-muted-foreground">{t(selected.descriptionKey)}</p>}
                </div>
              </section>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-popover px-4 py-3 sm:items-center sm:px-6">
          {loading || downloading ? <div className="mr-auto flex min-w-0 flex-1 flex-col gap-2 text-xs text-muted-foreground" role="status">
            <p className="flex items-center gap-2">
              <Spinner aria-hidden="true" />
              {t(downloading ? "product.menuPdf.preparing" : photoProgress?.total ? "product.menuPdf.designer.loadingPhotos" : "product.menuPdf.designer.loading", photoProgress ?? {})}
            </p>
            {loading && photoProgress?.total ? <Progress value={(photoProgress.completed / photoProgress.total) * 100} aria-label={t("product.menuPdf.designer.loading")} /> : null}
          </div> : null}
          <Button type="button" variant="outline" className="min-h-11" disabled={downloading} onClick={closeDialog}>
            {t("actions.cancel")}
          </Button>
          <Button type="button" className="min-h-11" disabled={!ready || downloading} onClick={() => onDownload(selectedId, selectedRows, background, effectiveHeroPhoto, photoOverrides)}>
            {downloading ? <Spinner data-icon="inline-start" /> : <FileText data-icon="inline-start" />}
            {t("product.menuPdf.designer.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
