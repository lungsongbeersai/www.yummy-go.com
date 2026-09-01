import type { Metadata } from "next";
import { OfflineSyncReviewPage } from "@/features/report/offline-sync/offline-sync-review-page";

export const metadata: Metadata = {
  title: "ລາຍການອອບລາຍທີ່ຕ້ອງກວດສອບ",
};

export default function Page() {
  return <OfflineSyncReviewPage />;
}
