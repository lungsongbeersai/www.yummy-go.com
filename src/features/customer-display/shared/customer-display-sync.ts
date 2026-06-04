export const CUSTOMER_DISPLAY_STORAGE_KEY = "yummy-go:customer-display-payload";
export const CUSTOMER_DISPLAY_CHANNEL = "yummy-go:customer-display";

export interface CustomerDisplayItem {
  image?: string | null;
  imageColor?: string | null;
  name: string;
  note?: string | null;
  price?: number | null;
  qty: number;
  status?: string | null;
  total: number;
}

export interface CustomerDisplayPayload {
  discount: number;
  grand_total: number;
  invoice?: string | null;
  items: CustomerDisplayItem[];
  service: number;
  subtotal: number;
  table_name: string;
  total: number;
  updated_at: string;
  vat: number;
}
