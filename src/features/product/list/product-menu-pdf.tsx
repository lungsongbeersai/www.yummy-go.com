"use client";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { waitForPaint } from "@/lib/export/paint";
import type { Product } from "@/services/product";
import {
  ProductMenuItem,
  ProductMenuCategoryTitle,
  ProductMenuSheet,
  ProductMenuTextItem,
  type ProductMenuBrand,
  type ProductMenuCopy,
} from "./product-menu-surface";
import { loadProductMenuImages } from "./product-menu-images";
import { normalizeMenuBackground, type ProductMenuBackground } from "./product-menu-background";
import { normalizeMenuHeroPhoto, normalizeMenuPhotoOverrides, type ProductMenuHeroPhoto } from "./product-menu-hero-photo";
import { getMenuTemplate, normalizeMenuCatalogRows, type MenuCatalogRows, type MenuTemplateId } from "./product-menu-templates";
import {
  buildProductMenu,
  paginateProductCatalog,
  paginateProductMenuColumns,
  type MenuCategory,
  type ProductMenuLabels,
  type ProductMenuPage,
} from "./product-menu-utils";

export class ProductMenuExportError extends Error {
  constructor(readonly code: "empty" | "layout" | "font") {
    super(code);
    this.name = "ProductMenuExportError";
  }
}

export interface ProductMenuPdfInput {
  products: readonly Product[];
  language: string;
  brand: ProductMenuBrand;
  copy: ProductMenuCopy;
  labels: ProductMenuLabels;
  templateId?: MenuTemplateId;
  rows?: MenuCatalogRows;
  background?: ProductMenuBackground;
  heroPhoto?: ProductMenuHeroPhoto;
  photoOverrides?: Readonly<Record<string, string>>;
  existingImages?: Readonly<Record<string, string>>;
  loadImage: (filename: string) => Promise<Blob>;
  onProgress?: (percent: number) => void;
}

function measureCards(host: HTMLElement) {
  const products: Record<string, number> = Object.create(null) as Record<string, number>;
  let fixedHeight = 0;
  for (const element of host.querySelectorAll<HTMLElement>("[data-menu-item]")) {
    const id = element.dataset.menuItem;
    const content = element.querySelector<HTMLElement>(".product-menu-item-content");
    if (!id || !content) throw new ProductMenuExportError("layout");
    const height = element.getBoundingClientRect().height;
    products[id] = Math.ceil(height);
    fixedHeight = Math.max(fixedHeight, Math.ceil(height - content.getBoundingClientRect().height));
  }
  return { products, fixedHeight };
}

function assertNoOverflow(element: HTMLElement) {
  if (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1) {
    throw new ProductMenuExportError("layout");
  }
}

function regroupPages(categories: readonly MenuCategory[], pages: readonly ProductMenuPage[]): MenuCategory[] {
  const fragments = pages.flatMap((page) => page.sections.flatMap((section) => section.items));
  return categories.map((category) => ({
    ...category,
    items: fragments.filter((item) => item.categoryId === category.id),
  }));
}

/** Each page is laid out and captured separately so rows and Lao glyphs never get sliced. */
export async function createProductMenuPdf(input: ProductMenuPdfInput) {
  const template = getMenuTemplate(input.templateId);
  const rows = normalizeMenuCatalogRows(input.rows);
  const background = normalizeMenuBackground(input.background);
  const heroPhoto = normalizeMenuHeroPhoto(input.heroPhoto);
  const categories = buildProductMenu(input.products, input.language, input.labels);
  const photoOverrides = normalizeMenuPhotoOverrides(input.photoOverrides, categories.flatMap((category) => category.items));
  const itemCount = categories.reduce((count, category) => count + category.items.length, 0);
  if (!itemCount) throw new ProductMenuExportError("empty");

  const host = document.createElement("div");
  host.className = "product-menu-export-host";
  host.setAttribute("aria-hidden", "true");
  document.body.append(host);
  const root = createRoot(host);
  let images: Record<string, string> = {};
  const renderPage = (page: ProductMenuPage, pageNumber = 1, pageCount = 1) => {
    flushSync(() => root.render(
      <ProductMenuSheet
        brand={input.brand}
        copy={input.copy}
        categories={categories}
        page={page}
        images={images}
        pageNumber={pageNumber}
        pageCount={pageCount}
        itemCount={itemCount}
        templateId={template.id}
        rows={rows}
        background={background}
        heroPhoto={heroPhoto}
      />,
    ));
  };

  try {
    renderPage({ sections: [] });
    const sheet = host.querySelector<HTMLElement>(".product-menu-sheet");
    if (!sheet) throw new ProductMenuExportError("layout");
    const font = getComputedStyle(sheet).fontFamily;
    try {
      const loaded = await Promise.all([
        document.fonts.load(`400 16px ${font}`, "ລາຍການອາຫານ Food Menu"),
        document.fonts.load(`700 24px ${font}`, "ລາຍການອາຫານ Food Menu"),
      ]);
      if (loaded.some((faces) => !faces.length)) throw new ProductMenuExportError("font");
    } catch {
      throw new ProductMenuExportError("font");
    }
    await document.fonts.ready;
    const assets = await loadProductMenuImages(categories, input.loadImage, {
      existingImages: input.existingImages,
      onProgress: (completed, total) => input.onProgress?.(10 + (total ? completed / total : 1) * 25),
    });
    // Apply per-dish uploads after shared source filenames have been loaded;
    // otherwise one upload could replace another dish sharing the same file.
    images = { ...assets.images, ...photoOverrides };
    const imageOmissions = categories.reduce((missing, category) => missing
      + category.items.filter((item) => !images[item.originalId ?? item.id]).length, 0);

    let pages: ProductMenuPage[] = [];
    if (template.layout === "catalog") {
      // A wrapped category heading takes space above its grid. Use the smallest
      // available grid so every category's cards fit without cutting content.
      let cardHeight = Number.POSITIVE_INFINITY;
      let gridWidth = Number.POSITIVE_INFINITY;
      for (const category of categories) {
        renderPage({ sections: [{ ...category, items: [], continued: true }] });
        const grid = host.querySelector<HTMLElement>("[data-menu-grid]");
        if (!grid) throw new ProductMenuExportError("layout");
        const gridBox = grid.getBoundingClientRect();
        const rowGap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0;
        cardHeight = Math.min(cardHeight, Math.floor((gridBox.height - rowGap * (rows - 1)) / rows) - 1);
        gridWidth = Math.min(gridWidth, gridBox.width);
      }
      if (!Number.isFinite(cardHeight) || cardHeight < 100 || gridWidth < template.columns * 100) throw new ProductMenuExportError("layout");
      const measurements = document.createElement("div");
      measurements.className = "product-menu-sheet product-menu-measure";
      measurements.dataset.menuTemplate = template.id;
      measurements.dataset.menuRows = String(rows);
      measurements.style.width = `${gridWidth}px`;
      measurements.style.setProperty("--menu-columns", String(template.columns));
      measurements.style.setProperty("--menu-rows", String(rows));
      host.append(measurements);
      const measurementRoot = createRoot(measurements);
      try {
        let measurementCategories = categories;
        let fits = false;
        for (let pass = 0; pass < 16; pass += 1) {
          flushSync(() => measurementRoot.render(
            <div className="product-menu-catalog-grid">
              {measurementCategories.flatMap((category) => category.items.map((item) => (
                <ProductMenuItem key={item.id} item={item} copy={input.copy} images={images} />
              )))}
            </div>,
          ));
          await waitForPaint();
          const measured = measureCards(measurements);
          try {
            pages = paginateProductCatalog(measurementCategories, {
              columns: template.columns,
              rows,
              cardHeight,
              productFixedHeight: measured.fixedHeight,
              productHeights: measured.products,
            });
          } catch {
            throw new ProductMenuExportError("layout");
          }
          if (Object.values(measured.products).every((height) => height <= cardHeight)) {
            fits = true;
            break;
          }
          measurementCategories = regroupPages(categories, pages);
        }
        if (!fits || !pages.length) throw new ProductMenuExportError("layout");
      } finally {
        measurementRoot.unmount();
        measurements.remove();
      }
    } else {
      renderPage({ sections: [] });
      const columns = Array.from(host.querySelectorAll<HTMLElement>("[data-menu-text-column]"));
      const columnCount = template.layout === "directory" ? 3 : template.layout === "bistro" ? 2 : 1;
      if (columns.length !== columnCount) throw new ProductMenuExportError("layout");
      const columnHeights = columns.map((column) => Math.floor(column.getBoundingClientRect().height) - 4);
      const columnHeight = Math.min(...columnHeights);
      const columnWidth = Math.floor(Math.min(...columns.map((column) => column.getBoundingClientRect().width)));
      const categoryGap = Math.max(0, Number.parseFloat(getComputedStyle(columns[0]).rowGap) || 0);
      if (columnHeight < 160 || columnWidth < 100) throw new ProductMenuExportError("layout");
      const measurements = document.createElement("div");
      measurements.className = "product-menu-sheet product-menu-text-measure-host";
      measurements.dataset.menuTemplate = template.id;
      measurements.dataset.menuRows = String(rows);
      measurements.style.width = `${columnWidth}px`;
      measurements.style.setProperty("--menu-rows", String(rows));
      host.append(measurements);
      const measurementRoot = createRoot(measurements);
      try {
        let measurementCategories = categories;
        let fits = false;
        for (let pass = 0; pass < 16; pass += 1) {
          flushSync(() => measurementRoot.render(
            <div className="product-menu-text-column product-menu-text-measure">
              {measurementCategories.map((category) => (
                <section className="product-menu-text-section" data-menu-measure-category={category.id} key={category.id}>
                  <ProductMenuCategoryTitle category={{ ...category, continued: true }} copy={input.copy} />
                  <div className="product-menu-text-items">
                    {category.items.map((item) => <ProductMenuTextItem key={item.id} item={item} copy={input.copy} images={images} showPhoto={template.layout !== "editorial"} />)}
                  </div>
                </section>
              ))}
            </div>,
          ));
          await waitForPaint();
          const products = measureCards(measurements).products;
          const itemsElement = measurements.querySelector<HTMLElement>(".product-menu-text-items");
          const itemGap = itemsElement ? Math.max(0, Number.parseFloat(getComputedStyle(itemsElement).rowGap) || 0) : 0;
          const categoryHeights: Record<string, number> = Object.create(null) as Record<string, number>;
          for (const section of measurements.querySelectorAll<HTMLElement>("[data-menu-measure-category]")) {
            const id = section.dataset.menuMeasureCategory;
            if (!id) throw new ProductMenuExportError("layout");
            const items = Array.from(section.querySelectorAll<HTMLElement>("[data-menu-item]"));
            const itemsHeight = items.reduce((height, item) => height + item.getBoundingClientRect().height, 0);
            categoryHeights[id] = Math.ceil(section.getBoundingClientRect().height - itemsHeight - Math.max(0, items.length - 1) * itemGap);
          }
          try {
            pages = paginateProductMenuColumns(measurementCategories, {
              columns: columnCount,
              columnHeight,
              columnHeights,
              productHeights: products,
              categoryHeights,
              itemGap,
              categoryGap,
              maxPhotosPerPage: template.layout === "editorial" ? rows * 2 : undefined,
              images,
            });
          } catch {
            throw new ProductMenuExportError("layout");
          }
          if (measurementCategories.every((category) => category.items.every((item) => products[item.id] + categoryHeights[category.id] <= columnHeight))) {
            fits = true;
            break;
          }
          measurementCategories = regroupPages(categories, pages);
        }
        if (!fits || !pages.length) throw new ProductMenuExportError("layout");
      } finally {
        measurementRoot.unmount();
        measurements.remove();
      }
    }

    input.onProgress?.(40);
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    pdf.setProperties({ title: `${input.brand.storeName} — ${input.copy.title}`, subject: input.copy.subtitle, creator: "Yummy Go" });
    for (const [index, page] of pages.entries()) {
      renderPage(page, index + 1, pages.length);
      await waitForPaint();
      const element = host.querySelector<HTMLElement>(".product-menu-sheet");
      if (!element) throw new ProductMenuExportError("layout");
      await Promise.all(Array.from(element.querySelectorAll("img"), (image) => image.decode()));
      const cards = element.querySelectorAll<HTMLElement>("[data-menu-item]");
      if (template.layout === "catalog" && cards.length > template.columns * rows) throw new ProductMenuExportError("layout");
      if (template.layout === "editorial") {
        const photoIds = new Set(page.sections.flatMap((section) => section.items).map((item) => item.originalId ?? item.id).filter((id) => images[id]));
        const galleryIds = new Set(Array.from(element.querySelectorAll<HTMLElement>("[data-menu-gallery-item]"), (tile) => tile.dataset.menuGalleryItem));
        if (photoIds.size > rows * 2 || photoIds.size !== galleryIds.size || [...photoIds].some((id) => !galleryIds.has(id))) throw new ProductMenuExportError("layout");
      }
      for (const content of element.querySelectorAll<HTMLElement>("[data-menu-body], [data-menu-grid], [data-menu-text-column], [data-menu-gallery], .product-menu-text-section, [data-menu-item], .product-menu-item-content")) assertNoOverflow(content);
      assertNoOverflow(element);
      // 2.5x A4 is 240 dpi. Sequential canvases keep long menus usable on tablets.
      const canvas = await html2canvas(element, {
        scale: 2.5,
        backgroundColor: getComputedStyle(element).backgroundColor,
        useCORS: false,
        logging: false,
        windowWidth: 1280,
        windowHeight: 1400,
      });
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 210, 297);
      canvas.width = 0;
      canvas.height = 0;
      input.onProgress?.(40 + ((index + 1) / pages.length) * 60);
    }
    return { pdf, itemCount, pageCount: pages.length, imageOmissions };
  } finally {
    root.unmount();
    host.remove();
  }
}
