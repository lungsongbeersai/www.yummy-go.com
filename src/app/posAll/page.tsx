import { Suspense } from "react";
import localFont from "next/font/local";
import { LoadingState } from "@/components/common/loading-state";
import { PublicPosRoute } from "@/features/public-pos/route/public-pos-route";

// ฟอนต์เฉพาะหน้าสั่งอาหารสาธารณะตามดีไซน์ Nightfall — self-host จากไฟล์ใน repo
// และโหลดที่ route นี้เท่านั้น จึงไม่เพิ่มน้ำหนักให้หน้าอื่นหรือพึ่ง Google ตอน build
//
// adjustFontFallback: false สำคัญมาก — ค่าเริ่มต้นของ next/font จะยัดฟอนต์สำรอง
// ที่ปรับ metric แล้วไว้ในตัวแปรเป็นลำดับที่ 2 เสมอ ฟอนต์สำรองพวกนี้อ้างอิงฟอนต์ระบบ
// ซึ่งเรนเดอร์อักษรลาวได้ เบราว์เซอร์จึงหยุดที่ตัวนั้นไม่เคยไปถึง Noto Sans Lao
// ที่วางไว้ถัดไป → อักษรลาวตกไปใช้ DokChampa ของ Windows (บทเรียนเดียวกับหน้า landing)
const cormorantGaramond = localFont({
  src: "../../design-system/font-files/cormorant-garamond-variable.ttf",
  weight: "500 700",
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-yg-serif-lat"
});

const notoSerifLao = localFont({
  src: "../../design-system/font-files/noto-serif-lao-variable.ttf",
  weight: "500 700",
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-yg-serif-lao"
});

const manrope = localFont({
  src: "../../design-system/font-files/manrope-variable.ttf",
  weight: "400 800",
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-yg-sans-var"
});

const fontVariables = [
  cormorantGaramond.variable,
  notoSerifLao.variable,
  manrope.variable
].join(" ");

export default function PublicPosAllPage() {
  return (
    <Suspense fallback={<LoadingState variant="posGrid" />}>
      <PublicPosRoute fontClassName={fontVariables} />
    </Suspense>
  );
}
