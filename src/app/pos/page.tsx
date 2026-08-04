import { Suspense } from "react";
import { Cormorant_Garamond, Manrope, Noto_Serif_Lao } from "next/font/google";
import { LoadingState } from "@/components/common/loading-state";
import { PublicPosRoute } from "@/features/public-pos/route/public-pos-route";

// ฟอนต์เฉพาะหน้าสั่งอาหารสาธารณะตามดีไซน์ Nightfall — โหลดที่ route นี้เท่านั้น
// ไม่แตะ root layout จึงไม่เพิ่มน้ำหนักให้หน้าอื่น
//
// adjustFontFallback: false สำคัญมาก — ค่าเริ่มต้นของ next/font จะยัดฟอนต์สำรอง
// ที่ปรับ metric แล้วไว้ในตัวแปรเป็นลำดับที่ 2 เสมอ ฟอนต์สำรองพวกนี้อ้างอิงฟอนต์ระบบ
// ซึ่งเรนเดอร์อักษรลาวได้ เบราว์เซอร์จึงหยุดที่ตัวนั้นไม่เคยไปถึง Noto Sans Lao
// ที่วางไว้ถัดไป → อักษรลาวตกไปใช้ DokChampa ของ Windows (บทเรียนเดียวกับหน้า landing)
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-yg-serif-lat"
});

const notoSerifLao = Noto_Serif_Lao({
  subsets: ["lao"],
  weight: ["500", "600", "700"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-yg-serif-lao"
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-yg-sans-var"
});

const fontVariables = [
  cormorantGaramond.variable,
  notoSerifLao.variable,
  manrope.variable
].join(" ");

export default function PublicPosPage() {
  return (
    <Suspense fallback={<LoadingState variant="posGrid" />}>
      <PublicPosRoute fontClassName={fontVariables} />
    </Suspense>
  );
}
