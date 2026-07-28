import type { Route } from "next";

// เมนู sidebar มาจาก permission API ซึ่งยังส่ง path ชุดก่อน P2.1 (/setting/*, /product, /printer,
// /sales/open-table-sale) redirects() ใน next.config.ts พาไปหน้าใหม่ให้ก็จริง แต่ pathname ที่ได้
// จะไม่ตรงกับ item.path จนไฮไลต์เมนู/breadcrumb ไม่ทำงาน จึงแปลงเป็น path ปัจจุบันตั้งแต่ตอนรับข้อมูล
// ตารางสองชุดนี้ต้องตรงกับ redirects() ใน next.config.ts เสมอ — แก้ที่นั่นแล้วต้องแก้ที่นี่ด้วย
// (/q/:token ไม่อยู่ในนี้เพราะ redirect ไปเป็น query string และไม่เคยโผล่ในเมนู)
const EXACT_ROUTE_ALIASES: Record<string, string> = {
  "/sale/counter-checkout": "/sales/sales-list",
  "/sale/order-customer": "/pos/order",
  "/sales/open-table-sale": "/pos/tables",
  // typo ที่ติดมาจากชื่อฟิลด์ฝั่ง backend (unite_*)
  "/setting/unite": "/settings/unit"
};

const SECTION_ROUTE_ALIASES: [legacy: string, current: string][] = [
  ["/setting", "/settings"],
  ["/product", "/products"],
  ["/printer", "/printers"]
];

// path จาก permission API → path จริงของแอปวันนี้ (ค่าที่ไม่เคยถูกย้ายจะคืนค่าเดิม)
export function canonicalRoute(path: string): string {
  if (!path.startsWith("/")) return path;

  const exact = EXACT_ROUTE_ALIASES[path];
  if (exact) return exact;

  for (const [legacy, current] of SECTION_ROUTE_ALIASES) {
    if (path === legacy) return current;
    // เทียบระดับ segment เท่านั้น ไม่งั้น /settings, /productions จะโดนเขียนทับ
    if (path.startsWith(`${legacy}/`)) return `${current}${path.slice(legacy.length)}`;
  }

  return path;
}

// เส้นทางเมนูบางส่วนมาจาก permission API ตอน runtime จึงตรวจแบบ compile-time ไม่ได้
// รวมจุด cast ไว้ที่เดียว: บังคับให้เป็น internal path เสมอ
export function isSafeInternalPath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !/[\\\p{Cc}\p{Cf}]/u.test(path)
  );
}

export function internalRoute(path: string): Route {
  const safe = isSafeInternalPath(path) ? path : "/";
  return canonicalRoute(safe) as Route;
}
