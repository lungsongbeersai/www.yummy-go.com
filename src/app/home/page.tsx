import { Suspense } from "react";
import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { LandingPage } from "@/features/landing/landing-page";

// ฟอนต์เฉพาะหน้า landing ตามดีไซน์ (ภาษาลาวใช้ Noto Sans Lao จาก root layout)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-space-grotesk"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
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
    <Suspense>
      <LandingPage className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`} />
    </Suspense>
  );
}
