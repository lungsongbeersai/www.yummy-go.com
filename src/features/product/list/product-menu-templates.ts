export const MENU_CATALOG_TEMPLATES = [
  { id: "bistro", layout: "bistro", columns: 2, rows: 4, nameKey: "product.menuPdf.templates.bistro.name", descriptionKey: "product.menuPdf.templates.bistro.description" },
  { id: "garden", layout: "catalog", columns: 3, rows: 4, nameKey: "product.menuPdf.templates.garden.name", descriptionKey: "product.menuPdf.templates.garden.description" },
  { id: "sunny", layout: "catalog", columns: 3, rows: 4, nameKey: "product.menuPdf.templates.sunny.name", descriptionKey: "product.menuPdf.templates.sunny.description" },
  { id: "classic", layout: "catalog", columns: 2, rows: 4, nameKey: "product.menuPdf.templates.classic.name", descriptionKey: "product.menuPdf.templates.classic.description" },
  { id: "midnight", layout: "catalog", columns: 2, rows: 4, nameKey: "product.menuPdf.templates.midnight.name", descriptionKey: "product.menuPdf.templates.midnight.description" },
  { id: "market", layout: "catalog", columns: 4, rows: 4, nameKey: "product.menuPdf.templates.market.name", descriptionKey: "product.menuPdf.templates.market.description" },
  { id: "cafe", layout: "catalog", columns: 3, rows: 4, nameKey: "product.menuPdf.templates.cafe.name", descriptionKey: "product.menuPdf.templates.cafe.description" },
  { id: "editorial", layout: "editorial", columns: 1, rows: 4, nameKey: "product.menuPdf.templates.editorial.name", descriptionKey: "product.menuPdf.templates.editorial.description" },
  { id: "promo", layout: "catalog", columns: 6, rows: 4, nameKey: "product.menuPdf.templates.promo.name", descriptionKey: "product.menuPdf.templates.promo.description" },
  { id: "directory", layout: "directory", columns: 3, rows: 4, nameKey: "product.menuPdf.templates.directory.name", descriptionKey: "product.menuPdf.templates.directory.description" },
  { id: "featured", layout: "catalog", columns: 3, rows: 4, nameKey: "product.menuPdf.templates.featured.name", descriptionKey: "product.menuPdf.templates.featured.description" },
] as const;

export type MenuCatalogTemplate = (typeof MENU_CATALOG_TEMPLATES)[number];
export type MenuTemplateId = MenuCatalogTemplate["id"];
export type MenuTemplateLayout = MenuCatalogTemplate["layout"];

export const MENU_CATALOG_ROW_OPTIONS = [4, 5, 6] as const;
export type MenuCatalogRows = (typeof MENU_CATALOG_ROW_OPTIONS)[number];

export const DEFAULT_MENU_CATALOG_ROWS: MenuCatalogRows = 4;

export function normalizeMenuCatalogRows(value: unknown): MenuCatalogRows {
  return value === 5 || value === 6 ? value : DEFAULT_MENU_CATALOG_ROWS;
}

export const DEFAULT_MENU_TEMPLATE_ID: MenuTemplateId = "bistro";

export function getMenuTemplate(id?: string): MenuCatalogTemplate {
  return MENU_CATALOG_TEMPLATES.find((template) => template.id === id) ?? MENU_CATALOG_TEMPLATES[0];
}
