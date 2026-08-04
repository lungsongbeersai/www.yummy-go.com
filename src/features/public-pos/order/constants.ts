import type { PublicPosAccent } from "./types";

// โทน accent ตั้งต้น — ใช้เมื่อยังไม่เคยเลือกเอง หรือตอน server render
// emerald ให้ตรงสีแบรนด์เดิม และตรง data-props ของไฟล์ดีไซน์
export const DEFAULT_PUBLIC_POS_ACCENT: PublicPosAccent = "emerald";
export const PUBLIC_POS_ACCENTS: readonly PublicPosAccent[] = [
  "emerald",
  "gold",
  "rose",
];
export const PUBLIC_POS_ACCENT_STORAGE_KEY = "yummy-go-public-pos-accent";

// สลับจาก Tweaks — ปิดไว้เป็นค่าเริ่มต้นเพราะ hero กินพื้นที่จอมาก
// ร้านที่อยากได้หน้าตาแบบกระชับ (โดยเฉพาะจอมือถือ) ไม่ต้องเลื่อนผ่านมันทุกครั้ง
export const DEFAULT_PUBLIC_POS_HERO_VISIBLE = false;
export const PUBLIC_POS_HERO_VISIBLE_STORAGE_KEY =
  "yummy-go-public-pos-hero-visible";

export const PRODUCT_RENDER_CHUNK = 12;
export const RAIL_RENDER_CHUNK = 12;
// การ์ดสินค้าในแถวเดียวกัน (รางเลื่อน/กริด) ถูก next/image ยืดเต็มกล่องเท่ากันหมด
// พอเรนเดอร์ขนาดเท่ากัน LCP จะถือว่า "เสมอกัน" แล้วเลือกรูปที่โหลดเสร็จก่อนเป็นตัวจริง
// ซึ่งไม่ใช่รูปแรกในลิสต์เสมอไป (ขึ้นกับความเร็วเน็ตของแต่ละไฟล์) เคยลองมาร์ค eager
// แค่รูปเดียวต่อบล็อกแล้วยัง LCP หลุดอยู่เพราะรูปที่ชนะจริงเป็นคนละใบในแถวเดียวกัน
// จึงมาร์ค eager ทุกใบในจำนวนนี้ต่อบล็อก ให้ครอบคลุมทุกใบที่มีสิทธิ์ชนะจริง ๆ
export const LCP_PRIORITY_IMAGE_COUNT = 6;
// auto-fill ตามดีไซน์ — คอลัมน์ปรับตามความกว้างจริงแทนการไล่ breakpoint
// ทำให้จอคั่นกลางอย่างแท็บเล็ตแนวตั้งไม่เหลือช่องว่างค้างท้ายแถว
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(clamp(152px,42vw,222px),1fr))] gap-[clamp(12px,2vw,18px)]";
export const CATEGORY_ANCHOR_FALLBACK_Y = 132;
export const CATEGORY_TAIL_SPACER_HEIGHT = "clamp(140px, 18dvh, 220px)";
export const CATEGORY_SCROLL_SUPPRESS_MS = 1800;
export const CATEGORY_LOAD_SCROLL_SUPPRESS_MS = 2600;
export const CATEGORY_SCROLL_RETRY_DELAY_MS = 80;
export const CATEGORY_SCROLL_MAX_RETRIES = 8;
export const CATEGORY_SCROLL_INITIAL_VERIFY_DELAY_MS = 720;
export const CATEGORY_SCROLL_ALIGNMENT_DELAY_MS = 160;
export const CATEGORY_SCROLL_ALIGNMENT_MAX_ATTEMPTS = 5;
export const CATEGORY_SCROLL_ALIGNMENT_TOLERANCE_PX = 10;
export const CATEGORY_BOTTOM_ACTIVE_THRESHOLD_PX = 32;
export const SCROLL_JUMP_EDGE_TOLERANCE_PX = 1;
export const SCROLL_JUMP_DURATION_MS = 420;
export const SCROLL_JUMP_VERIFY_DELAY_MS = 180;
export const SCROLL_JUMP_MAX_ATTEMPTS = 40;
export const SCROLL_JUMP_STABLE_PASSES = 3;
export const SCROLL_JUMP_SPY_SUPPRESS_MS =
  SCROLL_JUMP_DURATION_MS +
  SCROLL_JUMP_VERIFY_DELAY_MS * SCROLL_JUMP_MAX_ATTEMPTS +
  1000;
export const MAX_OPEN_QTY = 99;
export const PUBLIC_LOADING_MIN_MS = 1000;
export const DEFAULT_PUBLIC_CATEGORY_ICON = "mdi:folder-outline";
export const PUBLIC_SEARCH_HISTORY_LIMIT = 10;
export const PUBLIC_SEARCH_HISTORY_STORAGE_PREFIX =
  "yummy-go-public-pos-search-history";
export const PUBLIC_PRODUCT_LAYOUT_STORAGE_KEY =
  "yummy-go-public-pos-product-layout";
