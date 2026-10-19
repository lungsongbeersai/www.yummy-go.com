# Product Transfer Export and Import

## Goal

Allow a signed-in Yummy Go user to export the complete product catalog from the Products page and import it into another store or another user's store. The transfer must not reuse source-store identifiers, must preserve product configuration, and should carry product photos when the browser is allowed to download them.

## Current behavior

- The Products page already imports `.xlsx` and `.xls` files through `product-import-workbook.ts` and `product-import-utils.ts`.
- The spreadsheet import format covers product code and names, category, unit, size, cost, and sale/set price. It does not round-trip product image, stock mode, product notification, topping, taste, or the full Set configuration.
- `getProducts({ limit: "All" })` is already used by the import workflow. The product API model includes nested details, toppings, tastes, and Set choice configuration.
- Product photos are represented by a server filename or URL (`prod_image` / `prod_image_raw`) under `uploaded/products`; a color tile is represented by a hex value.
- Store, branch, category, unit, size, taste, topping, and Set child-option identifiers are scoped to their origin and cannot be reused in a destination store.
- Next.js is a stateless SSR shell. It must not become an image proxy or business-logic endpoint.

## Proposed format and flow

Use a versioned `.zip` transfer archive. It contains a JSON manifest with portable product records and an `images/` directory for photo bytes successfully retrieved from the configured product-image host. Keep source identifiers out of portable records. Preserve textual reference names alongside record configuration so the importer can resolve destination identifiers.

Export all products, independent of the active list page, search, category filter, or current status tab. Export must use the authenticated product store action/service path already used for full product loading. Each product record includes translated names and code; category and unit names; image mode, color or archive-relative photo; order point and notification; all product details and their prices, status, enabled and stock-deduction settings; topping and taste selections and limits; and Set groups, options, choice limits, and taste/child-option assignments.

Import the archive through the existing Products import entry point. Validate archive type, manifest version/schema, file count, expanded size, and records before writes. Show a preview with product count, reference items to be reused/created, and any missing photos or unresolved references. The user explicitly starts import from the preview. Keep existing Excel import behavior intact.

## Destination reference resolution

- Resolve categories within the selected/default destination group, and resolve or create units and normal/Set sizes using localized names, following the existing import reference planning behavior.
- Resolve or create topping, taste, and Set child-option master records in the destination store by bilingual names. Detect ambiguous name matches and block affected records instead of selecting an arbitrary UUID.
- Build each `SaveProductInput` with destination branch, category, unit, size, topping, taste, and child-option IDs. Generate local correlation references for Set choice groups. Never send source product/detail/store/branch/reference UUIDs.
- Keep product-code conflict handling consistent with the existing import flow. Do not overwrite an existing product implicitly; report conflicts in preview and require a clear resolution policy.

## Inventory and photos

- Preserve source stock quantity in the archive for traceability, but create destination details with quantity zero. Preserve stock deduction mode and other catalog configuration. Make the zero-stock behavior explicit in the preview.
- Attempt to fetch photo bytes directly from the configured public product image URL during export. If browser CORS or the server blocks download, record the image as unavailable and report it in the export result; do not silently claim that all photos transferred. Color tiles are fully portable and require no image file.
- During import, reconstruct image `File` values from archive entries and pass them through the existing product save service's multipart handling.
- If the configured image host does not grant browser access, a backend API change is required for guaranteed photo transfer. Do not add a Next.js proxy. The feature must still export the product manifest and clearly report unavailable photos.

## User experience

- Add an Export products action beside Import on the Products page; show progress while loading the full catalog and collecting images, then download the archive and report photo omissions.
- Accept `.zip` in the existing import dialog, retain the current `.xlsx` / `.xls` behavior, and display archive validation, reference conflicts, stock-zero behavior, image availability, and import results before/after mutation.
- Use existing semantic UI primitives, toast store actions, and English/Lao localization. Keep the flow usable on narrow screens.

## Safety and failure behavior

- Invalid, unsupported, oversized, or malformed archives fail before any product/reference writes.
- Reference ambiguity blocks affected products and names the conflicting references. API/transport failures remain errors; no local-success fallback.
- Product imports remain online and use product/store actions and services. No server actions or ad-hoc component fetches.
- Imports may partially succeed because the API exposes one product save at a time. Preserve the existing retry/success tracking pattern, and report each success/failure without implying transactional rollback.

## Acceptance criteria

1. Export downloads a versioned archive containing every product and all product configuration exposed by the product API, not just the current page or filter.
2. A generated archive can be selected in the existing importer and previewed before writes.
3. Import remaps all store-scoped relationships by names and uses destination UUIDs; source UUIDs are never submitted.
4. Imported stock quantity is zero while stock mode and source quantity provenance are retained.
5. Photos are included when CORS permits and omissions are visible; color tiles remain intact.
6. Existing spreadsheet imports continue to work unchanged.
7. English and Lao strings cover new actions, preview, warnings, and results.
8. `npm run typecheck`, `npm run lint`, and `npm run build` pass. Tests are not included in this stage unless requested separately.

## Open implementation checks

- Confirm actual CORS behavior for the configured product image host in a signed-in browser; the repository cannot prove remote server headers.
- Confirm API response shapes include the nested Set data needed to reconstruct every supported Set child-option/taste relation. If a field is not returned, report it as unsupported rather than infer it.
- Confirm actual CORS behavior for the configured product image host in a signed-in browser; the repository cannot prove remote server headers.

## Decision defaults

- Product-code collision: block the affected record and display the code; never overwrite or silently generate a replacement.
- Destination category group: use a group named `Imported Products`, reusing it only when the name resolves uniquely.
- Missing image bytes: export the manifest and mark the photo unavailable; show an omission count.
- ZIP import requires a preview; no reference or product writes occur before the user presses Import.
- API writes are per product, so partial failures keep completed products and allow retry of failed records only.
