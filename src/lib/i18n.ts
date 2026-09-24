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
      initAsync: false,
      react: { useSuspense: false }
    });

  i18n.on("languageChanged", (language) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("i18nextLng", toLanguage(language));
    }
  });
} else {
  // Dev server: the i18next singleton outlives hot reloads, so without this a newly added
  // key renders as its raw name on the server while the browser has the real text, which
  // is a hydration mismatch. Re-applying the bundles whenever this module re-evaluates
  // (i.e. when a locale JSON changes) keeps both sides in sync. No-op cost in production,
  // where the module evaluates once and takes the init branch.
  i18n.addResourceBundle("la", "common", laCommon, true, true);
  i18n.addResourceBundle("en", "common", enCommon, true, true);
}

export default i18n;
