"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import laCommon from "../../public/locales/la/common.json";
import enCommon from "../../public/locales/en/common.json";
import { DEFAULT_LANGUAGE, toLanguage } from "@/lib/language";

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: ["la", "en"],
      ns: ["common"],
      defaultNS: "common",
      resources: {
        la: { common: laCommon },
        en: { common: enCommon }
      },
      interpolation: { escapeValue: false },
      initImmediate: false,
      react: { useSuspense: false }
    });

  i18n.on("languageChanged", (language) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("i18nextLng", toLanguage(language));
    }
  });
}

export default i18n;
