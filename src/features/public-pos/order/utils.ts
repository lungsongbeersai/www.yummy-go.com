// Barrel re-export: this file used to hold every public-POS order helper (~1,300
// lines). It's now split by concern into sibling files — kept as a barrel so the
// ~30 existing importers across the feature don't all need updating in one batch.
export * from "./cart-domain";
export * from "./menu-render";
export * from "./numeric";
export * from "./product-domain";
export * from "./product-layout-mode";
export * from "./scroll-motion";
export * from "./search-history";
