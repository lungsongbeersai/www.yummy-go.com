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

export const appFonts = { sans, lao } as const;
export const appFontVariables = `${appFonts.sans.variable} ${appFonts.lao.variable}`;
