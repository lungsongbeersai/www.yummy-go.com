// เพจที่จำเป็นสำหรับงานขายตอนออฟไลน์ — อ้างอิงจาก OFFLINE_ROUTES/OFFLINE_GET_ROUTES ใน
// services/offline-sync.ts (API endpoint ที่รองรับ offline จริง) ต้องแก้คู่กันเสมอถ้าเพิ่ม/ลด endpoint
export const OFFLINE_READ_ONLY_PATHS = [
  "/sales/sales-list",
  "/report/daily-closing",
  "/report/daily-sales",
  "/report/best-selling-products",
  "/report/payment-methods",
  "/report/category-sales",
] as const;

export const OFFLINE_WRITE_CAPABLE_PATHS = [
  "/pos/tables",
  "/pos/order",
  "/order_manage",
] as const;

// เพจ infra ที่ต้องใช้งานได้เสมอไม่ว่าสถานะออฟไลน์จะเป็นอย่างไร (ไม่ใช่ส่วนหนึ่งของฟีเจอร์
// "sales-essential" — เป็นทางเข้า/ทางออกของแอปเอง)
export const OFFLINE_INFRA_PATHS = ["/", "/login", "/pos"] as const;

// เขียนข้อมูลตอนออฟไลน์ (requestLocalFallback ใน offline-sync.ts) ต้องพึ่ง Local Printer Agent
// ที่ 127.0.0.1:7777 เสมอ — Android ไม่มี agent ตัวนี้ (ใช้ native TCP printing แยกต่างหาก) เขียน
// ออฟไลน์บน Android จึง fail จริงทุกครั้ง ไม่ใช่แค่รอ sync จึงเหลือให้ใช้ได้แค่เพจอ่านอย่างเดียว
export function getOfflineAllowedPaths(isAndroidNative: boolean): readonly string[] {
  return isAndroidNative
    ? OFFLINE_READ_ONLY_PATHS
    : [...OFFLINE_READ_ONLY_PATHS, ...OFFLINE_WRITE_CAPABLE_PATHS];
}

export function isOfflineAllowedPath(pathname: string, isAndroidNative: boolean): boolean {
  return (
    (OFFLINE_INFRA_PATHS as readonly string[]).includes(pathname) ||
    getOfflineAllowedPaths(isAndroidNative).includes(pathname)
  );
}

export function getOfflineRedirectPath(isAndroidNative: boolean): string {
  return isAndroidNative ? OFFLINE_READ_ONLY_PATHS[0] : "/pos/tables";
}
