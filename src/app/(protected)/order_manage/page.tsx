import type { Metadata } from "next";
import { OrderQueuePage } from "@/features/pos/order-queue/order-queue-page";

export const metadata: Metadata = {
  title: "ຄິວອໍເດີ",
};

export default function Page() {
  return <OrderQueuePage />;
}
