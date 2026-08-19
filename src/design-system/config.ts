export const DESIGN_SYSTEM = {
  tokens: {
    stylesheet: "src/app/globals.css",
  },
  theme: {
    modes: ["light", "dark"],
  },
  fonts: {
    sans: {
      variable: "--font-sans",
      utility: "font-sans",
    },
    lao: {
      variable: "--font-noto-sans-lao",
      utility: "font-lao",
    },
  },
} as const;
