"use client";

import { useTranslation } from "react-i18next";

const la = {
  title: "ສິນຄ້າ ແລະ ເອກະສານການຄ້າ",
  searchStore: "ຄົ້ນຫາຮ້ານ", searchBranch: "ຄົ້ນຫາສາຂາ", selectStore: "ເລືອກຮ້ານ",
  back: "ກັບຄືນ", backToDocuments: "ກັບໄປໜ້າເອກະສານ", routeScopeUnavailable: "ຮ້ານ ຫຼື ສາຂາໃນລິ້ງນີ້ບໍ່ຢູ່ໃນສິດຂອງທ່ານ. ກະລຸນາກັບໄປເລືອກສາຂາທີ່ເຂົ້າເຖິງໄດ້", documentUnavailable: "ບໍ່ພົບເອກະສານໃນສາຂານີ້",
  createRecoveryHint: "ກະລຸນາລອງບັນທຶກອີກຄັ້ງເພື່ອຮັບເອກະສານເດີມກ່ອນແກ້ໄຂເພີ່ມ. ຫຼັງບັນທຶກສໍາເລັດ ທ່ານສາມາດເປີດແກ້ໄຂໄດ້",
  recoverDocument: "ລອງບັນທຶກເພື່ອຮັບເອກະສານເດີມ",
  editDocument: "ແກ້ໄຂເອກະສານ", saveChanges: "ບັນທຶກການແກ້ໄຂ", unsavedChanges: "ກໍາລັງແກ້ໄຂ / ຍັງບໍ່ບັນທຶກ",
  editDocumentHint: "ແກ້ໄຂສະເພາະເອກະສານນີ້. ເລກທີເອກະສານຄົງເດີມ ແລະ ເກັບປະຫວັດທຸກຄັ້ງທີ່ບັນທຶກ",
  discount: "ສ່ວນຫຼຸດ", discountOptional: "ສ່ວນຫຼຸດ (ບໍ່ບັງຄັບ)", discountType: "ປະເພດສ່ວນຫຼຸດ",
  discountHint: "ຫັກກ່ອນຄິດ VAT. ປ່ອຍວ່າງ ຫຼື ໃສ່ 0 ເພື່ອບໍ່ສະແດງໃນເອກະສານ",
  version: "ສະບັບ", updatedOn: "ແກ້ໄຂລ່າສຸດ", revisionHistory: "ປະຫວັດການແກ້ໄຂ", viewRevision: "ເບິ່ງສະບັບນີ້", noRevisions: "ຍັງບໍ່ມີປະຫວັດ", readOnlyRevision: "ສະບັບປະຫວັດ · ອ່ານຢ່າງດຽວ",
  revisionHistoryHint: "ເບິ່ງເອກະສານແຕ່ລະສະບັບທີ່ບັນທຶກໄວ້. ສະບັບເກົ່າບໍ່ສາມາດແກ້ໄຂໄດ້",
  versionConflict: "ເອກະສານມີການປ່ຽນແປງຈາກສະບັບທີ່ທ່ານເປີດ. ຮ່າງຂອງທ່ານຍັງຢູ່ ກະລຸນາເບິ່ງສະບັບລ່າສຸດກ່ອນ",
  viewLatest: "ເບິ່ງສະບັບລ່າສຸດ", reloadLatest: "ໂຫຼດສະບັບລ່າສຸດ", reloadLatestConfirm: "ປະຖິ້ມການແກ້ໄຂທີ່ຍັງບໍ່ບັນທຶກ ແລະ ໂຫຼດເອກະສານສະບັບລ່າສຸດແທນ?",
  linkedReceiptUnchanged: "ໃບຮັບເງິນທີ່ເຊື່ອມໄວ້ຍັງໃຊ້ຂໍ້ມູນສະບັບເດີມ. ຫາກຕ້ອງການປ່ຽນ ໃຫ້ເປີດແກ້ໄຂໃບຮັບເງິນແຍກຕ່າງຫາກ",
  sourceQuotationVersion: "ອ້າງອີງໃບສະເໜີລາຄາ",
  detailsTab: "ລາຍລະອຽດ", previewTab: "ເບິ່ງຕົວຢ່າງ", livePreview: "ຕົວຢ່າງເອກະສານ",
  livePreviewHint: "ຕົວຢ່າງ A4 ປ່ຽນຕາມຂໍ້ມູນທີ່ກໍາລັງພິມ", draft: "ຮ່າງ / DRAFT",
  editorHint: "ເບິ່ງຕົວຢ່າງຂະນະກໍາລັງແກ້ໄຂ. ເອກະສານຈະຖືກອອກ ແລະ ໄດ້ຮັບເລກທີເມື່ອກົດບັນທຶກເທົ່ານັ້ນ",
  printBlocked: "ບໍ່ສາມາດເປີດໜ້າພິມໄດ້. ກະລຸນາອະນຸຍາດໜ້າຕ່າງປັອບອັບແລ້ວລອງໃໝ່.",
  printHint: "ເອກະສານ A4 · ເລືອກ Save as PDF ໃນໜ້າຕ່າງພິມເພື່ອບັນທຶກໄຟລ໌.",
  showLogo: "ສະແດງໂລໂກ້", printPdf: "ພິມ / ບັນທຶກ PDF",
  subtitle: "ບັນທຶກລາຄາຄັ້ງດຽວ ແລະ ໃຊ້ຮ່ວມກັນໃນທຸກຮ້ານ ແລະ ສາຂາທີ່ທ່ານຈັດການ",
  sharedCatalog: "ລາຍການສິນຄ້າກາງ",
  sharedCatalogHint: "ບັນທຶກສິນຄ້າ ລາຄາ ແລະ ຮູບຄັ້ງດຽວ ເພື່ອເລືອກໃຊ້ໃນເອກະສານຂອງທຸກຮ້ານ ແລະ ສາຂາທີ່ທ່ານຈັດການ",
  catalogReadOnlyHint: "ລາຍການສິນຄ້າກາງຈັດການໂດຍຜູ້ບໍລິຫານ. ທ່ານສາມາດເລືອກໃຊ້ເພື່ອອອກເອກະສານໃຫ້ສາຂາຂອງທ່ານ",
  documentStore: "ຮ້ານສໍາລັບເອກະສານ", documentBranch: "ສາຂາສໍາລັບເອກະສານ",
  documentScopeHint: "ການເລືອກຮ້ານ ແລະ ສາຂາໃຊ້ສໍາລັບອອກ ແລະ ເບິ່ງເອກະສານ. ລາຍການສິນຄ້າໃຊ້ຮ່ວມກັນ",
  catalog: "ລາຍການສິນຄ້າ", quotations: "ໃບສະເໜີລາຄາ", receipts: "ໃບຮັບເງິນ",
  store: "ຮ້ານ", branch: "ສາຂາ", selectBranch: "ເລືອກສາຂາ", noBranches: "ບໍ່ມີສາຂາທີ່ເຂົ້າເຖິງໄດ້",
  retry: "ລອງອີກຄັ້ງ", refresh: "ໂຫຼດຄືນ", error: "ດໍາເນີນການບໍ່ສໍາເລັດ",
  addItem: "ເພີ່ມສິນຄ້າ", editItem: "ແກ້ໄຂສິນຄ້າ", edit: "ແກ້ໄຂ", save: "ບັນທຶກ", saving: "ກໍາລັງບັນທຶກ…", close: "ປິດ",
  name: "ຊື່ສິນຄ້າ", description: "ລາຍລະອຽດ", unit: "ຫົວໜ່ວຍ", price: "ລາຄາ/ໜ່ວຍ (ກີບ)", quantity: "ຈໍານວນ", amount: "ລວມ (ກີບ)",
  photo: "ຮູບສິນຄ້າ", photoHint: "ຮູບ JPEG, PNG ຫຼື WebP ບໍ່ເກີນ 5 MB (ບໍ່ບັງຄັບ)", photoInvalid: "ກະລຸນາເລືອກ JPEG, PNG ຫຼື WebP ຂະໜາດບໍ່ເກີນ 5 MB",
  removePhoto: "ລຶບຮູບ", removePhotoConfirm: "ລຶບຮູບນີ້ເມື່ອບັນທຶກສິນຄ້າ?", remove: "ລຶບ", cancel: "ຍົກເລີກ",
  showImages: "ສະແດງຮູບ", showItemImage: "ສະແດງຮູບໃນເອກະສານ", active: "ເປີດໃຊ້", inactive: "ປິດໃຊ້", showInactive: "ລວມລາຍການປິດໃຊ້",
  search: "ຄົ້ນຫາຊື່ ຫຼື ລາຍລະອຽດ", emptyCatalog: "ຍັງບໍ່ມີສິນຄ້າ", emptyCatalogHint: "ເພີ່ມສິນຄ້າ ແລະ ລາຄາຄັ້ງດຽວ ເພື່ອໃຊ້ໃນເອກະສານຂອງທຸກຮ້ານ ແລະ ສາຂາທີ່ທ່ານຈັດການ",
  saved: "ບັນທຶກສໍາເລັດ", itemRequired: "ກະລຸນາລະບຸຊື່ ແລະ ລາຄາເປັນຈໍານວນເຕັມຕັ້ງແຕ່ 0 ກີບ", catalogOutput: "ພິມ / PDF ລາຍການລາຄາ",
  sample: "ຕົວຢ່າງ PLC", sampleHint: "ເລືອກຕົວຢ່າງເພື່ອແກ້ໄຂ ແລະ ບັນທຶກເອງ",
  newQuotation: "ສ້າງໃບສະເໜີລາຄາ", newReceipt: "ສ້າງໃບຮັບເງິນ", customer: "ລູກຄ້າ", issuer: "ຜູ້ອອກເອກະສານ", companyName: "ຊື່ / ບໍລິສັດ", address: "ທີ່ຢູ່", phone: "ເບີໂທ", taxId: "ເລກປະຈໍາຕົວຜູ້ເສຍອາກອນ", bankDetails: "ຂໍ້ມູນບັນຊີທະນາຄານ", logoUrl: "ທີ່ຢູ່ຮູບໂລໂກ້",
  issuedOn: "ວັນທີອອກເອກະສານ", validUntil: "ລາຄາມີຜົນຮອດ", notes: "ໝາຍເຫດ / ເງື່ອນໄຂ", paymentMethod: "ວິທີຊໍາລະ", cash: "ເງິນສົດ", transfer: "ໂອນເງິນ", otherPayment: "ອື່ນໆ",
  items: "ລາຍການ", chooseItem: "ເລືອກຈາກລາຍການສິນຄ້າ", customLine: "ເພີ່ມລາຍການເອງ", removeLine: "ລຶບລາຍການ", removeLineConfirm: "ລຶບລາຍການນີ້ຈາກເອກະສານທີ່ກໍາລັງສ້າງ?",
  subtotal: "ລວມກ່ອນອາກອນ", tax: "ອາກອນ VAT", noTax: "ບໍ່ຄິດ VAT", total: "ລວມທັງໝົດ", lak: "ກີບ",
  saveDocument: "ບັນທຶກ ແລະ ເບິ່ງເອກະສານ", immutableHint: "ແຕ່ລະສະບັບທີ່ບັນທຶກຈະເກັບລາຄາ ແລະ ຂໍ້ມູນໃນເວລານັ້ນໄວ້ໃນປະຫວັດ",
  documentRequired: "ກະລຸນາລະບຸລູກຄ້າ ຜູ້ອອກ ວັນທີ ແລະ ລາຍການທີ່ຖືກຕ້ອງ (ຈໍານວນຫຼາຍກວ່າ 0, ລາຄາເຕັມກີບ)",
  emptyDocuments: "ຍັງບໍ່ມີເອກະສານ", emptyDocumentsHint: "ສ້າງເອກະສານໃໝ່ ຫຼື ເລືອກສາຂາອື່ນ", number: "ເລກທີ", viewDocument: "ເບິ່ງ / ພິມ / PDF", createReceipt: "ອອກໃບຮັບເງິນ", viewReceipt: "ເບິ່ງໃບຮັບເງິນ", receiptHint: "ຢືນຢັນວັນທີ ແລະ ວິທີຊໍາລະຂອງເງິນທີ່ໄດ້ຮັບ ໃບຮັບເງິນຈະເຊື່ອມກັບໃບສະເໜີລາຄານີ້", linkedQuotation: "ຈາກໃບສະເໜີລາຄາ", noResults: "ບໍ່ພົບລາຍການ", noPermission: "ທ່ານບໍ່ມີສິດເຂົ້າໃຊ້ໜ້ານີ້",
} as const;

const en: Record<keyof typeof la, string> = {
  title: "Catalog & commercial documents", subtitle: "Save prices once and reuse them across every store and branch you manage",
  searchStore: "Search stores", searchBranch: "Search branches", selectStore: "Select store", back: "Back", backToDocuments: "Back to documents", routeScopeUnavailable: "The store or branch in this link is outside your access. Return to documents and select an accessible branch.", documentUnavailable: "This document is unavailable in the selected branch",
  createRecoveryHint: "Retry to recover the document before making further changes. You can edit it after saving.", recoverDocument: "Retry to recover document",
  editDocument: "Edit document", saveChanges: "Save changes", unsavedChanges: "Unsaved changes", editDocumentHint: "Edit this document while keeping its number. Every save retains its revision history.",
  discount: "Discount", discountOptional: "Discount (optional)", discountType: "Discount type", discountHint: "Applied before VAT. Leave blank or enter 0 to hide it from the document.",
  version: "Version", updatedOn: "Last updated", revisionHistory: "Revision history", viewRevision: "View version", noRevisions: "No revisions yet", readOnlyRevision: "Historical version · read only", revisionHistoryHint: "View each saved document version. Previous versions cannot be edited.",
  versionConflict: "This document changed after you opened it. Your draft is preserved. Review the latest saved version before continuing.", viewLatest: "View latest version", reloadLatest: "Reload latest version", reloadLatestConfirm: "Discard your unsaved changes and replace them with the latest saved version?", linkedReceiptUnchanged: "The linked receipt keeps its earlier details. Open and edit the receipt separately if it also needs to change.", sourceQuotationVersion: "Source quotation",
  detailsTab: "Details", previewTab: "Preview", livePreview: "Live document preview", livePreviewHint: "A4 preview updates as you type", draft: "DRAFT / Not issued",
  editorHint: "Review the live preview while editing. The document is issued and receives a number only when you save.",
  sharedCatalog: "Shared catalog", sharedCatalogHint: "Save items, prices and photos once to reuse in documents for every store and branch you manage.",
  catalogReadOnlyHint: "Management maintains the shared catalog. You can use its items to issue documents for your branch.",
  documentStore: "Store for documents", documentBranch: "Branch for documents", documentScopeHint: "Store and branch selection applies to document creation and history. The catalog is shared.",
  printBlocked: "Unable to open the print window. Allow pop-ups and try again.", printHint: "A4 document · Choose Save as PDF in the print dialog to save a file.", showLogo: "Show logo", printPdf: "Print / Save PDF",
  catalog: "Catalog", quotations: "Quotations", receipts: "Receipts", store: "Store", branch: "Branch", selectBranch: "Select branch", noBranches: "No accessible branches",
  retry: "Try again", refresh: "Refresh", error: "Unable to complete this action", addItem: "Add item", editItem: "Edit item", edit: "Edit", save: "Save", saving: "Saving…", close: "Close",
  name: "Item name", description: "Description", unit: "Unit", price: "Unit price (LAK)", quantity: "Quantity", amount: "Amount (LAK)", photo: "Item photo", photoHint: "Optional JPEG, PNG or WebP, up to 5 MB", photoInvalid: "Choose a JPEG, PNG or WebP image up to 5 MB", removePhoto: "Remove photo", removePhotoConfirm: "Remove this photo when the item is saved?", remove: "Remove", cancel: "Cancel",
  showImages: "Show images", showItemImage: "Show image in documents", active: "Active", inactive: "Inactive", showInactive: "Include inactive items", search: "Search name or description", emptyCatalog: "No saved items", emptyCatalogHint: "Add items and prices once to reuse in documents for every store and branch you manage", saved: "Saved successfully", itemRequired: "Enter a name and a whole LAK price of zero or more", catalogOutput: "Print / PDF price list", sample: "PLC examples", sampleHint: "Choose an example, review it and save it yourself",
  newQuotation: "Create quotation", newReceipt: "Create receipt", customer: "Customer", issuer: "Issuer", companyName: "Name / company", address: "Address", phone: "Phone", taxId: "Tax ID", bankDetails: "Bank details", logoUrl: "Logo image URL", issuedOn: "Issue date", validUntil: "Valid until", notes: "Notes / terms", paymentMethod: "Payment method", cash: "Cash", transfer: "Bank transfer", otherPayment: "Other",
  items: "Items", chooseItem: "Add from catalog", customLine: "Add custom line", removeLine: "Remove line", removeLineConfirm: "Remove this line from the document draft?", subtotal: "Subtotal", tax: "VAT", noTax: "No VAT", total: "Total", lak: "LAK", saveDocument: "Save & view document", immutableHint: "Each saved version retains its prices and details in revision history", documentRequired: "Enter customer, issuer, dates and valid items (quantity above zero, whole LAK prices)", emptyDocuments: "No documents yet", emptyDocumentsHint: "Create a document or select another branch", number: "Number", viewDocument: "View / print / PDF", createReceipt: "Issue receipt", viewReceipt: "View receipt", receiptHint: "Confirm the date and payment method of the payment received. The receipt will be linked to this quotation", linkedQuotation: "From quotation", noResults: "No matching items", noPermission: "You do not have access to this page",
};

export const commercialLocales = { la, en };
export type CommercialLabelKey = keyof typeof la;
export type CommercialLabels = (key: CommercialLabelKey) => string;

export function useCommercialLabels(): CommercialLabels {
  const { t, i18n } = useTranslation();
  const fallback = (i18n.resolvedLanguage || i18n.language).startsWith("en") ? en : la;
  return (key) => t(`commercial.${key}`, { defaultValue: fallback[key] });
}
