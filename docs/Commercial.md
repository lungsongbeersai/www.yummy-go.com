# Branch catalog, quotations and receipts

The `/commercial` workspace records branch item prices and issues A4 commercial documents. The branch list also links directly to the selected store and branch. These documents do not create restaurant orders, change stock, or post to POS sales reports.

## Workflow

1. Select an accessible store and branch. Branch administrators are limited to their authenticated branch; other management access follows the existing live store classification and branch policy.
2. Add catalog items, whole-LAK prices, units and optional JPEG/PNG/WebP images up to 5 MB. Item image visibility and active status are saved on the server. The PLC examples prefill a form and never silently create records.
3. Create a quotation or receipt, review the editable issuer/customer details, and choose image visibility. VAT starts at zero; the ten-percent option is an explicit document setting.
4. Save before printing or downloading. Issued documents retain their own names, prices, images and totals even after catalog edits. Corrections require a new document.
5. After payment has been received, use **Issue receipt** on its quotation and confirm the date and payment method. The linked receipt uses the original quotation snapshot. Repeated conversion returns the same receipt.

Creation requests use a stable `request_uuid` for each editor draft. Retrying after a lost response returns the already-issued document rather than consuming another number. All replays still require current authentication, menu permission and branch access.

## Deployment

Deploy the companion Backend changes first. Its existing deployment workflow now runs:

```sh
npm run migrate:commercial-documents
```

The runner applies `20261114_add_commercial_documents.sql` and `20261114_add_commercial_menu.sql`. Both are rerunnable; existing issued snapshots and explicit permission denials are preserved. The menu migration follows each installation's existing Branches settings group and grants access only to eligible management scopes. A missing schema produces a visible `COMMERCIAL_MIGRATION_REQUIRED` error instead of a local success.

The API lives under `/api/v1/commercial` and uses the existing object-storage configuration. No new dependency, Next server business logic, offline database, or runtime secret is required. The default issuer logo is the bundled `/brand/plc-logo.png`; the issuer fields remain editable.

## Output

The preview, browser printing, price lists and PDF downloads share the isolated Lao document renderer. They follow the current Appearance → Lao font selection and use the same bundled font files as the app, with Noto Sans for Latin text and numbers. The print-only font stylesheet keeps these A4 documents independent of the legacy receipt font rules. Printing waits for fonts and requested images. PDF export measures complete rows, repeats headings, and keeps the final totals/signatures together. An unavailable requested image or an oversized row produces an error rather than a silently incomplete file. Users can explicitly hide images and export again.

Browser QA covers mobile/desktop widths, Lao dark mode, uploaded-image persistence, quotations, linked receipts, failed-response retries, branch isolation, image-load failures and multiple A4 pages. Physical printer output and native APK download handling require separate device acceptance.
