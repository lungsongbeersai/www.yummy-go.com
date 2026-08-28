import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderCustomerPage } from "@/features/pos/order-customer/order-customer-page";

export const metadata: Metadata = {
  title: "ອໍເດີລູກຄ້າ",
};

export default function Page() {
  // store_table_status (ร้านไม่มีโต๊ะ) อยู่ใน auth store ฝั่ง client เท่านั้น
  // เซิร์ฟเวอร์ตัดสินใจไม่ได้ว่าต้องมี table_uuid หรือไม่ — guard ย้ายไปที่
  // useOrderCustomerWorkflow แทน (order_uuid ของร้านไม่มีโต๊ะเก็บใน pos-store/
  // localStorage ไม่ผ่าน URL แล้ว — ดู src/stores/pos-store.ts) และต้องอ่าน
  // table_uuid ฝั่ง client เพื่อให้ shell /pos/order ที่ cache ไว้เปิดโต๊ะใดก็ได้
  // ขณะ offline โดยไม่ต้องมี RSC แยกสำหรับทุก query string
  return (
    <Suspense fallback={null}>
      <OrderCustomerPage />
    </Suspense>
  );
}
