import type { ApiEntity } from "@/services/shared/types";

export type CommercialDocumentType = "quotation" | "receipt";

export interface CatalogItem extends ApiEntity {
  item_uuid: string;
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
  item_uuid?: string;
  name: string;
  description?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  show_image?: boolean;
}

export interface CommercialDocumentItem extends Omit<CommercialDocumentItemInput, "item_uuid" | "show_image"> {
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
  tax_rate: 0 | 10;
  subtotal: number;
  tax_amount: number;
  total: number;
  source_quotation_uuid: string | null;
  receipt_uuid: string | null;
  items: CommercialDocumentItem[];
  created_at: string;
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
  tax_rate: 0 | 10;
  items: CommercialDocumentItemInput[];
}

export interface ConvertQuotationInput {
  branch_uuid: string;
  document_uuid: string;
  issued_on?: string;
  payment_method?: string;
  notes?: string;
}
