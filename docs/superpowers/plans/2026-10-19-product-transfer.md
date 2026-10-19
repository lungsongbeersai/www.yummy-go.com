# Product Transfer Export and Import Implementation Plan

> **For agentic workers:** Implement the tasks inline in this session; do not delegate subtasks. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export every product and its supported catalog configuration into a portable ZIP archive and import it into another store with destination-local IDs and zero starting stock.

**Architecture:** Keep archive codecs and portable data transformation in pure feature-domain modules. The product workflow orchestrates authenticated store actions, reference resolution, image fetching, and writes; the page and dialog only render workflow state and actions. Use `fflate` as a direct dependency for ZIP encoding/decoding; do not introduce Next server logic.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5.7 strict, Zustand 5, `fflate` 0.8, existing product services and shadcn primitives.

**Spec:** `docs/superpowers/specs/2026-10-19-product-transfer-design.md`

## Global Constraints

- Never use `any`.
- Components call store actions, never services directly.
- Runtime data access remains online through `src/services/` and the product store.
- Do not add Next Server Actions, ad-hoc component `fetch`, or a Next image proxy.
- Do not reuse source-store identifiers when creating destination products.
- Imported product detail stock quantity is zero; source quantity stays in the manifest for reference.
- Preserve existing Excel import behavior.
- Report all verification actually run; do not claim tests were run.

## Review Focus

- Malformed ZIP, unsupported manifest version, path traversal, and expanded-size bombs must fail before writes (Task 1 archive validation).
- Browser CORS denial or unavailable images must produce an explicit omission warning while preserving export of non-image data (Task 1 image collection and Task 3 result reporting).
- Duplicate product codes and ambiguous localized reference names must block affected records rather than overwrite or guess (Task 2 preflight mapping).
- Nested Set choice-group, child-option, and taste references must map by names and destination IDs (Task 2 payload construction).
- Session/store changes during a long export/import must not apply source data to a different target session (Task 3 session-scoped workflow).

---

### Task 1: Portable product archive codec

**Files:**
- Create: `src/features/product/list/product-transfer.ts`
- Create: `src/features/product/list/product-transfer-archive.ts`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- `exportProductTransfer(products: Product[], imageLoader: (product: Product) => Promise<Blob | null>): Promise<{ bytes: Uint8Array; imageOmissions: number }>` builds a versioned manifest and image entries.
- `parseProductTransferArchive(file: ProductTransferFile): Promise<ProductTransferManifest>` validates the ZIP and manifest before returning portable product records. `ProductTransferFile` is `{ name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }`.
- `PRODUCT_TRANSFER_LIMITS` defines 100 MB compressed, 200 MB expanded, 10,000 products, and 10,000 archive entries.

- [ ] Define version 1 portable records using product/detail/configuration values and localized reference names; replace source reference UUIDs with reference names and strip all source product/detail/store/branch IDs.
- [ ] Implement archive export as `products.json` plus deterministic safe image paths; preserve color tile values, record source detail stock, and include image status for each product.
- [ ] Implement archive parsing with extension, byte, entry-count, expanded-byte, manifest version, and required-shape validation. Reject absolute paths, `..` path segments, and duplicate manifest paths before decoding records.
- [ ] Add direct `fflate` dependency and confirm the existing project import style works in client bundles.

### Task 2: Destination reference resolution and save payload

**Files:**
- Modify: `src/stores/product-store/import-references.ts`
- Modify: `src/stores/product-store.ts`
- Create: `src/stores/product-store/product-transfer.ts`

**Interfaces:**
- `ensureProductTransferReferences(manifest, { storeUuid, language, defaultGroupName })` returns destination IDs for category, unit, normal/Set size, topping, taste, and Set child-option names, creating missing master records through the service layer.
- `buildProductTransferSaveInput(record, references, branchUuid, imageFile?)` returns a destination `SaveProductInput` with no source IDs and zero `pro_detail_qty_stock`.

- [ ] Extend store-owned reference resolution to reuse unique bilingual name matches, create absent names in the selected destination store, and return conflicts for ambiguous names.
- [ ] Preserve product/detail configuration, price fields, stock mode, enabled/status fields, notification and order point; do not copy source UUID fields.
- [ ] Rebuild Set choice groups with local client refs and remap per-detail groups, child option groups, and taste selections to destination IDs.
- [ ] Block records whose product codes collide with the destination branch or whose required reference mapping is ambiguous.

### Task 3: Export/import workflow and UI

**Files:**
- Modify: `src/features/product/list/use-product-list-workflow.ts`
- Modify: `src/features/product/list/product-page.tsx`
- Modify: `src/features/product/list/product-import-dialog.tsx`
- Modify: `public/locales/en/common.json`, `public/locales/la/common.json`

**Interfaces:**
- Workflow action `exportProducts(): Promise<void>` loads all products for the active branch through `loadAllForImport`, downloads the archive, and reports omitted photos.
- Workflow action `prepareImportFile(file)` dispatches `.zip` to the archive codec while retaining `.xlsx` / `.xls` parsing unchanged.
- Transfer state exposes manifest records, reference conflicts, image omissions, counts, loading/importing status, and result text to the existing import dialog.

- [ ] Add an export button beside Import, with disabled/progress state and semantic tokens.
- [ ] Fetch photo bytes directly from `getProductImageUrl` only when the source is a real image; capture network/CORS failure as an omission per product. Never use `mode: "no-cors"` or falsely mark opaque responses successful.
- [ ] Extend the existing import dialog to accept ZIP and show product preview, conflict counts, image omissions, and the zero-stock notice before the import action.
- [ ] Import validated records sequentially through product store actions, track successes/failures for retry, and refresh current product/reference lists after completion.
- [ ] Add English and Lao strings for export, progress, ZIP validation, preview, conflict and omission messages, zero-stock behavior, and results.

### Task 4: Verification and final review

**Files:**
- Review all changes from Tasks 1–3.

- [ ] Run `npm run typecheck`; fix errors caused by this feature.
- [ ] Run `npm run lint`; fix lint issues caused by this feature.
- [ ] Run `npm run build` (webpack); confirm production compilation.
- [ ] Inspect the diff against the spec and report that tests were not run unless the user separately requests them.

---

## Decision defaults

- Product-code collision: block the affected record and display the code; do not overwrite or auto-generate a replacement.
- Category group: use a single destination group named `Imported Products` by default, reusing it only when the name resolves uniquely.
- Missing image bytes: export the manifest and mark the photo unavailable; include an omission count in the export completion notice.
- Archive import: preview is required; no reference or product writes occur until the user presses Import.
- Partial API failure: keep successes, report failures, and allow retry of only failed records.
