import type { Metadata } from "next";
import { OrderCustomerPage } from "@/features/pos/order-customer/order-customer-page";
import { firstUrlParam } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ອໍເດີລູກຄ້າ",
};

export default async function Page(props: PageProps<"/pos/order">) {
  const params = await props.searchParams;

  // store_table_status (ร้านไม่มีโต๊ะ) อยู่ใน auth store ฝั่ง client เท่านั้น
  // เซิร์ฟเวอร์ตัดสินใจไม่ได้ว่าต้องมี table_uuid หรือไม่ — guard ย้ายไปที่
  // useOrderCustomerWorkflow แทน order_uuid ใช้ตามบิลของร้านไม่มีโต๊ะข้ามการรีเฟรชหน้า
  return (
    <OrderCustomerPage
      initialOrderUuid={firstUrlParam(params.order_uuid)}
      initialTableUuid={firstUrlParam(params.table_uuid)}
      initialTableName={firstUrlParam(params.table_name)}
    />
  );
}
