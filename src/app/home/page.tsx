import { Suspense } from "react";
import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { LoadingState } from "@/components/common/loading-state";
import { LandingPage } from "@/features/landing/landing-page";

// ฟอนต์เฉพาะหน้า landing ตามดีไซน์ (ภาษาลาวใช้ Noto Sans Lao จาก root layout)
//
// adjustFontFallback: false สำคัญมาก — ค่าเริ่มต้นของ next/font จะสร้างฟอนต์สำรองที่ปรับ metric แล้ว
// ("Space Grotesk Fallback" / "JetBrains Mono Fallback") ยัดไว้ในตัวแปรเป็นลำดับที่ 2 เสมอ
// ฟอนต์สำรองพวกนี้อ้างอิงฟอนต์ระบบซึ่งเรนเดอร์อักษรลาวได้ เบราว์เซอร์จึงหยุดที่ตัวนั้น
// ไม่เคยไปถึง Noto Sans Lao ที่เราวางไว้ถัดไป → อักษรลาวตกไปใช้ DokChampa ของ Windows
// ปิดทิ้งแล้วสแตกจะเหลือ "ฟอนต์ละติน → Noto Sans Lao" ซึ่งได้ทั้งสองภาษาถูกต้อง
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-space-grotesk"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-jetbrains-mono"
});

export const metadata: Metadata = {
  title: "PLC Lao Developer — Web Apps, Mobile Apps & Business Systems",
  description:
    "Founded in 2002, PLC Lao Developer creates scalable digital solutions for restaurants, insurance businesses, and modern companies.",
  icons: {
    icon: "/landing/plc-logo.png"
  }
};

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingState variant="page" />}>
      <LandingPage className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`} />
    </Suspense>
  );
}
