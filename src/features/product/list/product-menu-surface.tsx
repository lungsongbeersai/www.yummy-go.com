import Image from "next/image";
import { useTranslation } from "react-i18next";
import { getMenuTemplate, normalizeMenuCatalogRows, type MenuCatalogRows, type MenuTemplateId } from "./product-menu-templates";
import { type MenuCategory, type MenuCategorySegment, type MenuProduct, type ProductMenuPage } from "./product-menu-utils";
import { ProductMenuDetails } from "./product-menu-content";
import { ProductMenuReferenceSheet } from "./product-menu-reference-surface";
import type { ProductMenuBackground } from "./product-menu-background";
import { resolveMenuHeroPhoto, type ProductMenuHeroPhoto } from "./product-menu-hero-photo";
import { menuBackgroundAttributes, ProductMenuBackgroundLayer } from "./product-menu-background-surface";
export { ProductMenuTextItem, ProductMenuCategoryTitle } from "./product-menu-reference-surface";

export interface ProductMenuBrand {
  storeName: string;
  branchName: string;
  phone: string;
  address: string;
}

export interface ProductMenuCopy {
  title: string;
  subtitle: string;
  currency: string;
  continued: string;
  noPhoto?: string;
  pageLabel: (page: number, total: number) => string;
  itemsLabel: (count: number) => string;
  setOptions: string;
  optionLabel: string;
  priceLabel: string;
  setPriceLabel: string;
}

export interface ProductMenuSheetProps {
  brand: ProductMenuBrand;
  copy: ProductMenuCopy;
  categories: MenuCategory[];
  page: ProductMenuPage;
  images: Readonly<Record<string, string>>;
  pageNumber: number;
  pageCount: number;
  itemCount: number;
  templateId?: MenuTemplateId;
  rows?: MenuCatalogRows;
  background?: ProductMenuBackground;
  heroPhoto?: ProductMenuHeroPhoto;
}

function MenuPhotoPlaceholder({ label }: { label?: string }) {
  return <div className="product-menu-photo-placeholder" data-menu-placeholder>
    {label ? <span>{label}</span> : null}
  </div>;
}

export function ProductMenuItem({ item, copy, images }: {
  item: MenuProduct;
  copy: ProductMenuCopy;
  images: Readonly<Record<string, string>>;
}) {
  const image = images[item.originalId ?? item.id];
  return (
    <article className="product-menu-item" data-menu-item={item.id} data-menu-category={item.categoryId}>
      <div className="product-menu-photo" data-menu-photo>
        {image ? <Image src={image} alt="" width={640} height={400} unoptimized loading="eager" /> : <MenuPhotoPlaceholder label={copy.noPhoto} />}
        <span className="product-menu-dish-number">{String(item.number).padStart(2, "0")}</span>
        {item.continued ? <span className="product-menu-continuation-badge">{copy.continued}</span> : null}
      </div>
      <ProductMenuDetails item={item} copy={copy} />
    </article>
  );
}

function MenuHeader({ brand, copy, templateId, featuredImages, itemCount, hero }: {
  brand: ProductMenuBrand;
  copy: ProductMenuCopy;
  templateId: MenuTemplateId;
  featuredImages: string[];
  itemCount: number;
  hero: ReturnType<typeof resolveMenuHeroPhoto>;
}) {
  const branch = brand.branchName.normalize("NFKC").trim().toLowerCase() !== brand.storeName.normalize("NFKC").trim().toLowerCase() ? brand.branchName : "";
  return <header className={`product-menu-header product-menu-header-${templateId}`} data-menu-header>
    <div className="product-menu-header-content">
      <div className="product-menu-brand-line">
        <div className="product-menu-brand"><p className="product-menu-store-name">{brand.storeName}</p>{branch ? <p className="product-menu-branch-name">{branch}</p> : null}</div>
        <p className="product-menu-currency">{copy.currency}</p>
      </div>
      <div className="product-menu-title-line"><div><h1>{copy.title}</h1></div><span className="product-menu-item-count">{copy.itemsLabel(itemCount)}</span></div>
    </div>
    {hero && templateId !== "cafe" ? <Image className={templateId === "sunny" ? "product-menu-hero-photo" : templateId === "featured" ? "product-menu-featured-mark" : "product-menu-masthead-photo"} data-menu-main-photo data-menu-hero-product={hero.productId} src={hero.src} alt="" width={240} height={240} unoptimized loading="eager" /> : null}
    {templateId === "cafe" && hero ? <div className="product-menu-header-photo-strip">{[hero.src, ...featuredImages.filter((src) => src !== hero.src)].slice(0, 3).map((src, index) => <Image key={src} data-menu-main-photo={index === 0 ? true : undefined} data-menu-hero-product={index === 0 ? hero.productId : undefined} src={src} alt="" width={120} height={120} unoptimized loading="eager" />)}</div> : null}
  </header>;
}

export function ProductMenuSheet({ brand, copy, categories, page, images, pageNumber, pageCount, itemCount, templateId, rows, background, heroPhoto }: ProductMenuSheetProps) {
  const template = getMenuTemplate(templateId);
  if (template.layout !== "catalog") return <ProductMenuReferenceSheet brand={brand} copy={copy} categories={categories} page={page} images={images} pageNumber={pageNumber} pageCount={pageCount} itemCount={itemCount} templateId={template.id} rows={rows} background={background} heroPhoto={heroPhoto} />;
  const selectedRows = normalizeMenuCatalogRows(rows);
  const section = page.sections[0];
  const category = categories.find((entry) => entry.id === section?.id) ?? section;
  const featuredImages = [...new Set((category?.items ?? []).map((item) => images[item.originalId ?? item.id]).filter(Boolean))];
  const heroProducts = !heroPhoto || heroPhoto.mode === "auto" ? category?.items ?? categories.flatMap((entry) => entry.items) : categories.flatMap((entry) => entry.items);
  const hero = resolveMenuHeroPhoto(heroPhoto, heroProducts, images);
  const categoryNumber = categories.findIndex((entry) => entry.id === section?.id) + 1;
  return <article className="product-menu-sheet" data-menu-template={template.id} data-menu-layout="catalog" data-menu-rows={selectedRows} {...menuBackgroundAttributes(background)}>
    <ProductMenuBackgroundLayer background={background} />
    <MenuHeader brand={brand} copy={copy} templateId={template.id} featuredImages={featuredImages} itemCount={itemCount} hero={hero} />
    {section ? <header className="product-menu-category-heading" data-menu-category-heading={section.id}>
      <span className="product-menu-category-index">{String(Math.max(1, categoryNumber)).padStart(2, "0")}</span>
      <div><h2>{section.name}</h2>{section.continued ? <p>{copy.continued}</p> : null}</div>
      <span className="product-menu-category-count">{copy.itemsLabel(category?.items.length ?? section.items.length)}</span>
    </header> : null}
    <div className="product-menu-body product-menu-catalog-grid" data-menu-body data-menu-grid data-menu-column>
      {page.sections.flatMap((entry) => entry.items.map((item) => <ProductMenuItem key={item.id} item={item} copy={copy} images={images} />))}
    </div>
    <footer className="product-menu-footer" data-menu-footer>
      <div className="product-menu-contact">{brand.phone ? <span className="product-menu-phone">{brand.phone}</span> : null}{brand.address ? <span className="product-menu-address">{brand.address}</span> : null}</div>
      <span className="product-menu-page-number">{copy.pageLabel(pageNumber, pageCount)}</span>
    </footer>
  </article>;
}

/** Scaled print components show the selected real category and its loaded photos. */
export function ProductMenuTemplatePreview({ templateId, categories, images, rows, categoryId, background, heroPhoto }: {
  templateId: MenuTemplateId;
  categories: MenuCategory[];
  images: Readonly<Record<string, string>>;
  rows?: MenuCatalogRows;
  categoryId?: string;
  background?: ProductMenuBackground;
  heroPhoto?: ProductMenuHeroPhoto;
}) {
  const { t } = useTranslation();
  const template = getMenuTemplate(templateId);
  const selectedRows = normalizeMenuCatalogRows(rows);
  const category = categories.find((entry) => entry.id === categoryId) ?? categories[0];
  const capacity = template.columns * selectedRows;
  const copy: ProductMenuCopy = {
    title: t("product.menuPdf.title"), subtitle: t("product.menuPdf.subtitle"), currency: t("product.menuPdf.currency"),
    continued: t("product.menuPdf.continued"), noPhoto: t("product.menuPdf.noPhoto"), setOptions: t("product.menuPdf.setOptions"),
    optionLabel: t("product.menuPdf.optionLabel"), priceLabel: t("product.menuPdf.priceLabel"), setPriceLabel: t("product.menuPdf.setPriceLabel"),
    pageLabel: (page, total) => t("product.menuPdf.page", { page, total }), itemsLabel: (count) => t("product.menuPdf.items", { count }),
  };
  const categoryIndex = Math.max(0, categories.findIndex((entry) => entry.id === category?.id));
  const previewCategories = categories.slice(categoryIndex);
  const editorialSections: MenuCategorySegment[] = [];
  let previewPhotoCount = 0;
  let previewItemCount = 0;
  for (const entry of previewCategories) {
    const items: MenuProduct[] = [];
    for (const item of entry.items) {
      const hasPhoto = Boolean(images[item.originalId ?? item.id]);
      if ((hasPhoto && previewPhotoCount >= selectedRows * 2) || previewItemCount >= 20) break;
      items.push(item);
      if (hasPhoto) previewPhotoCount += 1;
      previewItemCount += 1;
    }
    if (items.length) editorialSections.push({ ...entry, continued: false, column: 0, items });
    if (items.length < entry.items.length) break;
  }
  const page: ProductMenuPage = { sections: category ? template.layout === "catalog"
    ? [{ ...category, continued: false, items: category.items.slice(0, capacity) }]
    : template.layout === "editorial"
      ? editorialSections
      : template.layout === "bistro"
        ? previewCategories.slice(0, 2).flatMap((entry, column) => {
          if (column === 0 && entry.items.length > 10) return [{ ...entry, column: 0, continued: false, items: entry.items.slice(0, 10) }, { ...entry, column: 1, continued: true, items: entry.items.slice(10, 18) }];
          if (column === 1 && (previewCategories[0]?.items.length ?? 0) > 10) return [];
          return [{ ...entry, column, continued: false, items: entry.items.slice(0, column === 0 ? 10 : 8) }];
        })
        : previewCategories.slice(0, 3).map((entry, column) => ({ ...entry, column, continued: false, items: entry.items.slice(0, 10) })) : [] };
  const products = categories.flatMap((entry) => entry.items);
  const pageCount = categories.reduce((total, entry) => total + Math.ceil(entry.items.length / capacity), 0);
  return <div className="product-menu-preview" aria-hidden="true">
    <ProductMenuSheet brand={{ storeName: t("product.menuPdf.restaurant"), branchName: "", phone: "", address: "" }} copy={copy} categories={categories} page={page} images={images} pageNumber={1} pageCount={Math.max(1, pageCount)} itemCount={products.length} templateId={templateId} rows={selectedRows} background={background} heroPhoto={heroPhoto} />
  </div>;
}
