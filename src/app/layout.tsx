import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Providers } from "@/app/providers";
import { appFontVariables } from "@/design-system/fonts";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, toLanguage } from "@/lib/language";
import { WINDOW_OPEN_FONT_STYLESHEET_HREF } from "@/lib/window-open-fonts";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: {
    default: "Yummy Go POS",
    template: "%s | Yummy Go",
  },
  description: "Clean rebuilt restaurant POS workspace",
  icons: {
    icon: "/brand/icon.png",
    apple: "/brand/icon.png"
  }
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

const THEME_COLORS = ["emerald", "blue", "amber", "rose", "violet"];
const FONT_SCALES = ["sm", "md", "lg"];

const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem("yummy-go-app");
    var parsed = stored ? JSON.parse(stored) : null;
    var state = parsed && parsed.state ? parsed.state : null;
    var theme = state && state.theme === "dark" ? "dark" : "light";
    var themeColor = state && ${JSON.stringify(THEME_COLORS)}.indexOf(state.themeColor) !== -1 ? state.themeColor : "emerald";
    var fontScale = state && ${JSON.stringify(FONT_SCALES)}.indexOf(state.fontScale) !== -1 ? state.fontScale : "md";
    var root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.dataset.themeColor = themeColor;
    root.dataset.fontScale = fontScale;
    root.style.colorScheme = theme;
  } catch (_) {
    var fallbackRoot = document.documentElement;
    fallbackRoot.classList.remove("dark");
    fallbackRoot.dataset.theme = "light";
    fallbackRoot.dataset.themeColor = "emerald";
    fallbackRoot.dataset.fontScale = "md";
    fallbackRoot.style.colorScheme = "light";
  }
})();
`;

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
