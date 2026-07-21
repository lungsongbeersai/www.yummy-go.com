import type { Route } from "next";

// เส้นทางเมนูบางส่วนมาจาก permission API ตอน runtime จึงตรวจแบบ compile-time ไม่ได้
// รวมจุด cast ไว้ที่เดียว: บังคับให้เป็น internal path เสมอ
export function internalRoute(path: string): Route {
  return (path.startsWith("/") && !path.startsWith("//") ? path : "/") as Route;
}
