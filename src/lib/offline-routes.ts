// เพจที่จำเป็นสำหรับงานขายตอนออฟไลน์ — อ้างอิงจาก OFFLINE_ROUTES/OFFLINE_GET_ROUTES ใน
// services/offline-sync.ts (API endpoint ที่รองรับ offline จริง) ต้องแก้คู่กันเสมอถ้าเพิ่ม/ลด endpoint
export const OFFLINE_READ_ONLY_PATHS = [
  // Master data ที่ Local Agent มี projection ให้อยู่แล้ว (localProductManagementResponse /
  // localStockResponse / register/fetch_limit / branch/fetch_all) — เปิดให้ "อ่าน" ตอนออฟไลน์
  // เท่านั้น ปุ่มเพิ่ม/แก้/ลบถูกปิดด้วย useOfflineReadOnly เพราะ route เขียนของ master data
  // ไม่ได้อยู่ใน OFFLINE_ROUTES และไม่มี conflict policy รองรับการแก้ตอนออฟไลน์
  "/products",
  "/stock",
  // เพจเครื่องพิมพ์: /api/v1/printer/fetch อยู่ใน OFFLINE_GET_ROUTES อยู่แล้ว (Agent ตอบจาก
  // localPrintersResponse, Android อ่านจาก Dexie mirror) — ตอนเน็ตหลุดคือตอนที่หน้าร้านต้องเปิดดู
  // ว่าเครื่องพิมพ์ตัวไหนเปิด/ปิดอยู่มากที่สุด จึงไม่ล็อกเมนูนี้ ส่วนปุ่มเพิ่ม/แก้/ลบ/เปิด-ปิด/ทดสอบพิมพ์
  // ถูกปิดด้วย useOfflineReadOnly เพราะทั้ง route เขียนและ build-test-job ต้องใช้ backend
  "/printers",
  "/settings/user",
  "/settings/branch",
  "/sales/sales-list",
  "/report/daily-closing",
  "/report/daily-sales",
  "/report/best-selling-products",
  "/report/payment-methods",
  "/report/category-sales",
  // fetch_table is in OFFLINE_GET_ROUTES already (Agent answers from its own
  // SQLite; Android reads the Dexie mirror the same way /sales/sales-list
  // does) — the grid itself was reachable offline before this, only the route
  // guard (isOfflineAllowedPath) bounced Android away from it because the
  // page also lives in OFFLINE_WRITE_CAPABLE_PATHS below for opening a table.
  "/pos/tables",
] as const;

export const OFFLINE_WRITE_CAPABLE_PATHS = [
  "/pos/tables",
  "/pos/order",
  "/order_manage",
  "/report/offline-sync",
  // ອໍເດີຄ້າງສົ່ງ: คุยกับ Local Agent ที่ 127.0.0.1:7777 อย่างเดียว ไม่แตะ backend เลย
  // จึงใช้ได้ทั้งตอนออนไลน์และออฟไลน์ — แต่ไม่รวม Android เพราะไม่มี Agent ให้ถาม
  "/sales/stuck-orders",
] as const;

// เขียนออฟไลน์บน Android ไม่ผ่าน Local Agent อีกต่อไป (write-fallback.ts สังเคราะห์
// คำตอบจาก Dexie outbox แทน) แต่ยังจำกัดแค่วงจรออเดอร์เดิม (เปิดโต๊ะ/สั่ง/ยืนยันครัว/เสิร์ฟ/
// จ่ายเงิน) — ย้ายโต๊ะ/รวมบิล/แยกบิล/พิมพ์ยังต้องมี Agent เท่านั้น จึงยังไม่รวม
// /order_manage หรือ /sales/stuck-orders ให้ Android
const ANDROID_OFFLINE_WRITE_CAPABLE_PATHS = ["/pos/tables", "/pos/order"] as const;

// เพจ infra ที่ต้องใช้งานได้เสมอไม่ว่าสถานะออฟไลน์จะเป็นอย่างไร (ไม่ใช่ส่วนหนึ่งของฟีเจอร์
// "sales-essential" — เป็นทางเข้า/ทางออกของแอปเอง)
export const OFFLINE_INFRA_PATHS = ["/", "/login", "/pos"] as const;

export function getOfflineAllowedPaths(isAndroidNative: boolean): readonly string[] {
  return isAndroidNative
    ? [...OFFLINE_READ_ONLY_PATHS, ...ANDROID_OFFLINE_WRITE_CAPABLE_PATHS]
    : [...OFFLINE_READ_ONLY_PATHS, ...OFFLINE_WRITE_CAPABLE_PATHS];
}

export function isOfflineAllowedPath(pathname: string, isAndroidNative: boolean): boolean {
  return (
    (OFFLINE_INFRA_PATHS as readonly string[]).includes(pathname) ||
    getOfflineAllowedPaths(isAndroidNative).includes(pathname)
  );
}

export function getOfflineRedirectPath(isAndroidNative: boolean): string {
  // Named, not OFFLINE_READ_ONLY_PATHS[0]: adding a page to that list must never
  // silently move where an offline device lands.
  return isAndroidNative ? "/sales/sales-list" : "/pos/tables";
}
