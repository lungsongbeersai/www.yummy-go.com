import Image from "next/image";
import { ProductMenuDetails } from "./product-menu-content";
import { getMenuTemplate, normalizeMenuCatalogRows } from "./product-menu-templates";
import type { MenuCategory, MenuCategorySegment, MenuProduct } from "./product-menu-utils";
import type { ProductMenuCopy, ProductMenuSheetProps } from "./product-menu-surface";
import { resolveMenuHeroPhoto } from "./product-menu-hero-photo";
import { menuBackgroundAttributes, ProductMenuBackgroundLayer } from "./product-menu-background-surface";

export function ProductMenuCategoryTitle({ category, copy }: {
  category: MenuCategory & { continued?: boolean };
  copy: ProductMenuCopy;
}) {
  return <header className="product-menu-category-heading product-menu-text-category-heading" data-menu-category-heading={category.id}>
    <div><h2>{category.name}</h2>{category.continued ? <p>{copy.continued}</p> : null}</div>
    <span className="product-menu-category-count">{copy.itemsLabel(category.items.length)}</span>
  </header>;
}

export function ProductMenuTextItem({ item, copy, images, showPhoto = false }: {
  item: MenuProduct;
  copy: ProductMenuCopy;
  images: Readonly<Record<string, string>>;
  showPhoto?: boolean;
}) {
  const image = images[item.originalId ?? item.id];
  return <article className="product-menu-text-item" data-menu-item={item.id} data-menu-category={item.categoryId}>
    <span className="product-menu-dish-number">{String(item.number).padStart(2, "0")}</span>
    {showPhoto && image ? <div className="product-menu-text-photo" data-menu-photo><Image src={image} alt="" width={96} height={96} unoptimized loading="eager" /></div> : null}
    <ProductMenuDetails item={item} copy={copy} />
    {item.continued ? <span className="product-menu-text-continuation">{copy.continued}</span> : null}
  </article>;
}

function ReferenceTextColumn({ sections, categories, images, copy, showPhoto }: {
  sections: MenuCategorySegment[];
  categories: MenuCategory[];
  images: Readonly<Record<string, string>>;
  copy: ProductMenuCopy;
  showPhoto: boolean;
}) {
  return <div className="product-menu-text-column" data-menu-text-column data-menu-column>
    {sections.map((section, index) => {
      const source = categories.find((category) => category.id === section.id) ?? section;
      return <section key={`${section.id}:${index}`} className="product-menu-text-section">
        <ProductMenuCategoryTitle category={{ ...source, continued: section.continued }} copy={copy} />
        <div className="product-menu-text-items">{section.items.map((item) => <ProductMenuTextItem key={item.id} item={item} copy={copy} images={images} showPhoto={showPhoto} />)}</div>
      </section>;
    })}
  </div>;
}

export function ProductMenuReferenceSheet({ brand, copy, categories, page, images, pageNumber, pageCount, itemCount, templateId, rows, background, heroPhoto }: ProductMenuSheetProps) {
  const template = getMenuTemplate(templateId);
  const selectedRows = normalizeMenuCatalogRows(rows);
  const editorial = template.layout === "editorial";
  const bistro = template.layout === "bistro";
  const branch = brand.branchName.normalize("NFKC").trim().toLowerCase() !== brand.storeName.normalize("NFKC").trim().toLowerCase() ? brand.branchName : "";
  const sourceProducts = new Map(categories.flatMap((category) => category.items).map((item) => [item.id, item]));
  const photoItems = new Map<string, MenuProduct>();
  for (const section of page.sections) for (const item of section.items) {
    const originalId = item.originalId ?? item.id;
    if (images[originalId] && !photoItems.has(originalId)) photoItems.set(originalId, sourceProducts.get(originalId) ?? item);
  }
  const hero = resolveMenuHeroPhoto(heroPhoto, categories.flatMap((category) => category.items), images);
  const showHeaderPhoto = !bistro && hero && (!editorial || heroPhoto?.mode === "product" || heroPhoto?.mode === "image");
  const header = <header className="product-menu-reference-header" data-menu-header data-menu-header-photo={showHeaderPhoto ? "true" : undefined}>
    {showHeaderPhoto && hero ? <Image className="product-menu-reference-main-photo" data-menu-main-photo data-menu-hero-product={hero.productId} src={hero.src} alt="" width={240} height={240} unoptimized loading="eager" /> : null}
    <p className="product-menu-reference-store">{brand.storeName}</p>
    {branch ? <p className="product-menu-reference-branch">{branch}</p> : null}
    {editorial || bistro ? <p className="product-menu-reference-wordmark" aria-hidden="true">{bistro ? "Menu" : "MENU"}</p> : <span className={`product-menu-reference-total${itemCount > 999 ? " product-menu-reference-total-dense" : ""}`}>{itemCount}</span>}
    <h1>{copy.title}</h1>
    <p className="product-menu-reference-currency">{copy.currency}</p>
  </header>;
  return <article className="product-menu-sheet product-menu-reference-sheet" data-menu-template={template.id} data-menu-layout={template.layout} data-menu-rows={selectedRows} {...menuBackgroundAttributes(background)}>
    <ProductMenuBackgroundLayer background={background} />
    {bistro ? <>
      <div className="product-menu-reference-body product-menu-bistro-body" data-menu-body>
        <div className="product-menu-bistro-list">
          {header}
          <ReferenceTextColumn sections={page.sections.filter((section) => (section.column ?? 0) === 0)} categories={categories} images={images} copy={copy} showPhoto />
        </div>
        <div className="product-menu-bistro-list">
          {hero ? <figure className="product-menu-bistro-hero" data-menu-hero={hero.productId}>
            <div className="product-menu-bistro-hero-frame">
              <Image data-menu-main-photo data-menu-hero-product={hero.productId} src={hero.src} alt="" width={640} height={640} unoptimized loading="eager" />
            </div>
          </figure> : null}
          <ReferenceTextColumn sections={page.sections.filter((section) => (section.column ?? 0) === 1)} categories={categories} images={images} copy={copy} showPhoto />
        </div>
      </div>
    </> : editorial ? <div className="product-menu-reference-body product-menu-editorial-body" data-menu-body data-menu-has-photos={hero || photoItems.size ? "true" : "false"}>
      <div className="product-menu-editorial-list">
        {header}
        <ReferenceTextColumn sections={page.sections} categories={categories} images={images} copy={copy} showPhoto={false} />
      </div>
      <aside className="product-menu-editorial-gallery" data-menu-gallery data-menu-gallery-single={photoItems.size === 1 ? "true" : undefined}>
        {Array.from(photoItems, ([originalId, item], index) => <figure key={originalId} className="product-menu-editorial-gallery-item" data-menu-gallery-item={originalId}
          data-menu-gallery-wide={photoItems.size <= selectedRows || index < selectedRows * 2 - photoItems.size ? "true" : undefined}
          data-menu-gallery-row-span={photoItems.size <= selectedRows ? Math.floor(selectedRows / photoItems.size) + (index < selectedRows % photoItems.size ? 1 : 0) : 1}>
          <Image src={images[originalId]} alt="" width={640} height={480} unoptimized loading="eager" />
          <figcaption><span>{String(item.number).padStart(2, "0")}</span>{item.name}</figcaption>
        </figure>)}
        {!photoItems.size && hero ? <figure className="product-menu-editorial-gallery-cover" data-menu-gallery-cover><Image src={hero.src} alt="" width={640} height={960} unoptimized loading="eager" /></figure> : null}
      </aside>
    </div> : <>
      {header}
      <div className="product-menu-reference-body product-menu-directory-columns" data-menu-body>
        {[0, 1, 2].map((column) => <ReferenceTextColumn key={column} sections={page.sections.filter((section) => (section.column ?? 0) === column)} categories={categories} images={images} copy={copy} showPhoto />)}
      </div>
    </>}
    <footer className="product-menu-footer" data-menu-footer>
      <div className="product-menu-contact">{brand.phone ? <span className="product-menu-phone">{brand.phone}</span> : null}{brand.address ? <span className="product-menu-address">{brand.address}</span> : null}</div>
      <span className="product-menu-page-number">{copy.pageLabel(pageNumber, pageCount)}</span>
    </footer>
  </article>;
}
