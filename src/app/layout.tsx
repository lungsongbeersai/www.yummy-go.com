import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Noto_Sans_Lao } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/app/providers";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, toLanguage } from "@/lib/language";
import "./globals.css";
import "@/features/dashboard/overview/dashboard.css";

const notoSansLao = Noto_Sans_Lao({
  subsets: ["lao"],
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
  variable: "--font-noto-sans-lao"
});

export const metadata: Metadata = {
  title: "Yummy Go POS",
  description: "Clean rebuilt restaurant POS workspace",
  icons: {
    icon: "/brand/icon.png",
    apple: "/brand/icon.png"
  }
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem("yummy-go-app");
    var parsed = stored ? JSON.parse(stored) : null;
    var theme = parsed && parsed.state && parsed.state.theme === "dark" ? "dark" : "light";
    var root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (_) {
    var fallbackRoot = document.documentElement;
    fallbackRoot.classList.remove("dark");
    fallbackRoot.dataset.theme = "light";
    fallbackRoot.style.colorScheme = "light";
  }
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialLanguage = toLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value ?? DEFAULT_LANGUAGE);

  return (
    <html lang={initialLanguage} className={notoSansLao.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <Providers initialLanguage={initialLanguage}>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
