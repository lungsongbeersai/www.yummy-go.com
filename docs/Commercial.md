# Shared catalog, quotations and receipts

The `/commercial` workspace records a reusable item and price catalog for the authenticated operator's store and issues A4 commercial documents. Save each item, price and photo once, then reuse it across every store and branch that operator can manage. For PLC management this includes authorized customer stores; each customer store retains its own separate catalog when its users sign in. The store and branch selectors choose the document destination and history, and do not switch catalog ownership. These documents do not create restaurant orders, change stock, or post to POS sales reports.

## Workflow

1. Select an accessible store and branch for documents. Branch administrators are limited to their authenticated branch; other management access follows the existing live store classification and branch policy. Switching the document destination retains the shared catalog.
2. Management roles 1 and 2 can add or edit shared items, whole-LAK prices, units and optional JPEG/PNG/WebP images up to 5 MB. Item image visibility and active status are saved on the server. Branch administrators can read the catalog and use its items in their own branch's documents, but cannot change the shared items. The PLC examples prefill a form and never silently create records.
3. Create a quotation or receipt in the full-screen editor. Desktop shows the form on the left and its live A4 document preview on the right, with separate scrolling. Mobile provides Details and Preview tabs that retain the same form, edits and preview. Customer/issuer details, items, prices, images, dates, notes and VAT update the preview immediately. VAT starts at zero; the ten-percent option is an explicit document setting.
4. Leave the optional footer discount blank or zero to omit it from the preview, issued document and PDF. Enter a whole-LAK amount or a percentage with up to two decimal places to deduct it before VAT. The discount cannot exceed the subtotal.
5. Save before printing or downloading. Issued documents retain their own names, prices, images and totals even after catalog edits. Choose **Edit document** from history or the saved preview to fetch the latest version into the same full-screen editor. Existing lines retain their original text, prices and photos even if their catalog item has since changed or become inactive. Saving keeps the document UUID/number and records a new revision.
6. Use **Revision history** to view earlier saved snapshots read-only. A version conflict leaves the editing draft intact: review the latest saved version, or explicitly confirm replacing the draft with it. Linked documents are edited separately; editing a quotation does not change an already-linked receipt.
7. After payment has been received, use **Issue receipt** on its quotation and confirm the date and payment method. Conversion checks the displayed quotation version before issuing a new receipt, and pins the source quotation number/version. Repeated conversion returns the same linked receipt.

Creation requests use a stable `request_uuid` for each attempted document. After an ambiguous creation failure the form locks its attempted content while retry recovers that exact document; further corrections can be made after recovery. Update retries reuse one request UUID for identical content. Changing content after a failed update creates a new operation while retaining the originally loaded expected version, so a committed earlier attempt produces a visible conflict rather than discarding new edits. All replays still require current authentication, menu permission and branch access.

The live preview uses the same document renderer, selected system font and photo/logo rules as issued documents. New documents display a draft marker instead of an issued number; editing an issued document keeps its number and shows an unsaved-changes badge. Typing does not save anything or offer draft printing/PDF export. Save remains an explicit action and validates the single form before recording an immutable version snapshot. Saving from the mobile Preview tab returns to Details so missing required fields remain visible and focusable.

Catalog responses carry `catalog_store_uuid`, which must match the authenticated store. The retained item `branch_uuid` records its creation provenance; it does not restrict reuse or image access to that branch. The request's selected `branch_uuid` remains an authorized context, while the server derives catalog ownership from the live authenticated actor. Neither the selected customer store nor a client-supplied owner can change it. A wrong-owner response rejects the entire result and clears cached catalog data. Logout or owner changes also invalidate pending catalog work. Document reads, writes and saved snapshots remain strictly scoped to their target branch.

## Deployment

Deploy the companion Backend changes first. Its existing deployment workflow now runs:

```sh
npm run migrate:commercial-documents
```

The runner applies `20261114_add_commercial_documents.sql`, `20261114_share_commercial_catalog_by_store.sql`, `20261114_add_commercial_document_revisions.sql` and `20261114_add_commercial_menu.sql`. All are rerunnable; existing issued snapshots and explicit permission denials are preserved. The catalog migration backfills authenticated-store ownership for existing items without moving their original branch or photo. The revisions migration retains the initial issued version while adding edit history, stable line identities and optional discount values. The menu migration follows each installation's existing Branches settings group and grants access only to eligible management scopes. A missing schema produces a visible `COMMERCIAL_MIGRATION_REQUIRED` error instead of a local success.

The API lives under `/api/v1/commercial` and uses the existing object-storage configuration. No new dependency, Next server business logic, offline database, or runtime secret is required. The default issuer logo is the bundled `/brand/plc-logo.png`; the issuer fields remain editable.

## Output

The preview, browser printing, price lists and PDF downloads share the isolated Lao document renderer. They follow the current Appearance → Lao font selection and use the same bundled font files as the app, with Noto Sans for Latin text and numbers. The print-only font stylesheet keeps these A4 documents independent of the legacy receipt font rules. Printing waits for fonts and requested images. PDF export measures complete rows, repeats headings, and keeps the final totals/signatures together. An unavailable requested image or an oversized row produces an error rather than a silently incomplete file. Users can explicitly hide images and export again.

Verification covers shared-catalog reuse and original images across target stores/branches, owner isolation, management-only catalog changes, document branch isolation and late/lost responses. Browser QA also covers mobile/desktop widths, Lao dark mode, uploaded-image persistence, quotations, linked receipts, image-load failures and multiple A4 pages. Physical printer output and native APK download handling require separate device acceptance.
