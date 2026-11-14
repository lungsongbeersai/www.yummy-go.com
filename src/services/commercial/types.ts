import type { ApiEntity } from "@/services/shared/types";

export type CommercialDocumentType = "quotation" | "receipt";
export type CommercialDiscountType = "amount" | "percent";
export type CommercialPaymentCurrency = "LAK" | "THB" | "USD";

export interface CommercialPaymentProfile extends ApiEntity {
  profile_uuid: string;
  label: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: CommercialPaymentCurrency;
  qr_image?: string | null;
}

export interface SaveCommercialPaymentProfileInput extends ApiEntity {
  profile_uuid?: string;
  label?: string;
  bank_name?: string;
  account_name: string;
  account_number: string;
  currency: CommercialPaymentCurrency;
  qr_image?: File;
  remove_qr?: boolean;
}

export interface CommercialPaymentAccountReference {
  profile_uuid?: string;
  snapshot_uuid?: string;
}

export interface CommercialPaymentDetailsInput {
  show_accounts: boolean;
  show_qr: boolean;
  accounts: CommercialPaymentAccountReference[];
}

export interface CommercialPaymentAccountSnapshot {
  snapshot_uuid: string;
  profile_uuid?: string | null;
  label: string;
  bank_name: string;
  account_name: string;
  account_number?: string;
  currency: CommercialPaymentCurrency;
  qr_image?: string | null;
  has_qr?: boolean;
}

export interface CommercialPaymentDetails {
  show_accounts: boolean;
  show_qr: boolean;
  accounts: CommercialPaymentAccountSnapshot[];
}

export interface CatalogItem extends ApiEntity {
  item_uuid: string;
  catalog_store_uuid: string;
  /** Creation provenance only; catalogue ownership is catalog_store_uuid. */
  branch_uuid: string;
  name: string;
  description: string;
  unit: string;
  unit_price: number;
  image_url: string | null;
  image_visible: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveCatalogItemInput extends ApiEntity {
  branch_uuid: string;
  item_uuid?: string;
  name: string;
  description?: string;
  unit?: string;
  unit_price: number;
  image_visible: boolean;
  active: boolean;
  remove_image?: boolean;
  image?: File;
}

export interface CommercialParty {
  name: string;
  address?: string;
  phone?: string;
  tax_id?: string;
  bank_details?: string;
  logo_url?: string | null;
}

export interface CommercialDocumentItemInput {
  line_uuid?: string;
  item_uuid?: string;
  name: string;
  description?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  show_image?: boolean;
}

export interface CommercialDocumentItem extends Omit<CommercialDocumentItemInput, "item_uuid" | "show_image"> {
  line_uuid: string;
  item_uuid: string | null;
  line_total: number;
  image_url: string | null;
  show_image: boolean;
}

export interface CommercialDocument extends ApiEntity {
  document_uuid: string;
  branch_uuid: string;
  number: string;
  document_type: CommercialDocumentType;
  issued_on: string;
  valid_until: string | null;
  customer: CommercialParty;
  issuer: CommercialParty;
  notes: string;
  payment_method: string;
  show_images: boolean;
  payment_details?: CommercialPaymentDetails;
  tax_rate: 0 | 10;
  discount_type: CommercialDiscountType | null;
  discount_value: number;
  discount_amount: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  source_quotation_uuid: string | null;
  source_quotation_version: number | null;
  source_quotation_number?: string | null;
  receipt_uuid: string | null;
  items: CommercialDocumentItem[];
  created_at: string;
  version: number;
  updated_at: string;
  updated_by: string;
}

export interface CreateCommercialDocumentInput extends ApiEntity {
  request_uuid?: string;
  branch_uuid: string;
  document_type: CommercialDocumentType;
  issued_on: string;
  valid_until?: string | null;
  customer: CommercialParty;
  issuer: CommercialParty;
  notes?: string;
  payment_method?: string;
  show_images: boolean;
  payment_details?: CommercialPaymentDetailsInput;
  tax_rate: 0 | 10;
  discount_type?: CommercialDiscountType | null;
  discount_value?: number;
  items: CommercialDocumentItemInput[];
}

export interface UpdateCommercialDocumentInput extends CreateCommercialDocumentInput {
  document_uuid: string;
  request_uuid: string;
  expected_version: number;
}

export interface CommercialDocumentRevision extends ApiEntity {
  version: number;
  request_uuid: string | null;
  changed_at: string;
  changed_by: string;
  snapshot: CommercialDocument;
}

export interface ConvertQuotationInput {
  branch_uuid: string;
  document_uuid: string;
  issued_on?: string;
  payment_method?: string;
  notes?: string;
  expected_version?: number;
}
