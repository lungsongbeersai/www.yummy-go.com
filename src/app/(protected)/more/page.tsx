import type { Metadata } from "next";
import { NativeMorePage } from "@/components/layout/capacitor/more-page";

export const metadata: Metadata = {
  title: "ເພີ່ມເຕີມ",
};

export default function Page() {
  return <NativeMorePage />;
}
