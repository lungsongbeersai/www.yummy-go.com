import localFont from "next/font/local";

const sans = localFont({
  src: "../../public/fonts/Noto_Sans/NotoSans-VariableFont_wdth,wght.ttf",
  display: "swap",
  variable: "--font-sans",
});

const lao = localFont({
  src: "../../public/fonts/Noto_Sans_Lao/NotoSansLao-VariableFont_wdth,wght.ttf",
  display: "swap",
  variable: "--font-noto-sans-lao",
});

// Lao typefaces a user can pick instead of Noto Sans Lao (Appearance → Lao font, app-store
// laoFont). preload: false — the browser fetches a face only once html[data-lao-font] points
// --font-lao-ui at it (globals.css), so nobody downloads fonts they did not choose.
// Noto Serif Lao and Phetsarath are SIL OFL 1.1 (OFL.txt beside each file); Saysettha OT is the
// face the receipt printer CSS already ships (public/fonts/window-open-fonts.css).
const notoSerifLao = localFont({
  src: "../../public/fonts/Noto_Serif_Lao/NotoSerifLao-VariableFont_wdth,wght.ttf",
  display: "swap",
  preload: false,
  variable: "--font-noto-serif-lao",
  weight: "100 900",
});

const phetsarath = localFont({
  src: [
    { path: "../../public/fonts/Phetsarath/Phetsarath-Regular.ttf", style: "normal", weight: "400" },
    { path: "../../public/fonts/Phetsarath/Phetsarath-Bold.ttf", style: "normal", weight: "700" },
  ],
  display: "swap",
  preload: false,
  variable: "--font-phetsarath",
});

const saysettha = localFont({
  src: "../../public/fonts/saysettha_ot.ttf",
  display: "swap",
  preload: false,
  variable: "--font-saysettha",
  weight: "400",
});

export const appFonts = { sans, lao, notoSerifLao, phetsarath, saysettha } as const;
export const appFontVariables = Object.values(appFonts)
  .map((font) => font.variable)
  .join(" ");
