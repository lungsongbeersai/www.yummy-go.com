import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Providers } from "@/app/providers";
import { appFontVariables } from "@/design-system/fonts";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, toLanguage } from "@/lib/language";
import { themeBootstrapScript } from "@/lib/theme-bootstrap-script";
import { WINDOW_OPEN_FONT_STYLESHEET_HREF } from "@/lib/window-open-fonts";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: {
    default: "Yummy Go POS",
    template: "%s | Yummy Go",
  },
  description: "Clean rebuilt restaurant POS workspace",
  // ไอคอนแท็บเดียวกันทุกหน้า (หน้าแนะนำ, ล็อกอิน, POS) — กำหนดที่นี่ที่เดียว ห้าม override รายหน้า
  // favicon ต้องมีมุมโปร่งใสในตัว เพราะเบราว์เซอร์ไม่ลบมุมให้; ส่วน apple-touch-icon ต้องทึบเต็มกรอบ
  // เพราะ iOS ตัดมุมเอง (มุมโปร่งใสจะกลายเป็นสีดำบนหน้าจอโฮม)
  icons: {
    icon: [{ url: "/brand/icon-mark-rounded.png", sizes: "192x192", type: "image/png" }],
    apple: "/brand/icon-mark.png"
  }
};

// No maximumScale/userScalable here — covers the public posAll page too; see docs/Decisions.md > "Disable pinch-zoom on staff-only routes".
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialLanguage = toLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value ?? DEFAULT_LANGUAGE);

  return (
    <html
      lang={initialLanguage}
      className={cn(initialLanguage === "la" ? "font-lao" : "font-sans", appFontVariables)}
      suppressHydrationWarning
    >
      <head>
        <link rel="stylesheet" href={WINDOW_OPEN_FONT_STYLESHEET_HREF} />
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body>
        <Providers initialLanguage={initialLanguage}>{children}</Providers>
      </body>
    </html>
  );
}
