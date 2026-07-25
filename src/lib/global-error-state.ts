import { DEFAULT_LANGUAGE, toLanguage, type Language } from "@/lib/language";

export interface GlobalErrorClientState {
  theme: "dark" | "light";
  lang: Language;
}

export interface GlobalErrorCopy {
  title: string;
  body: string;
  retry: string;
  reference: string;
}

// global-error แทนที่ root layout ทั้งใบ จึงต้องอ่าน theme/lang เองแบบไม่พึ่ง provider ใดๆ
// (logic เดียวกับ themeBootstrapScript ใน layout.tsx — อ่านจาก persisted app-store)
export function readGlobalErrorClientState(): GlobalErrorClientState {
  if (typeof window === "undefined") {
    return { theme: "light", lang: DEFAULT_LANGUAGE };
  }
  let theme: "dark" | "light" = "light";
  try {
    const stored = window.localStorage.getItem("yummy-go-app");
    const parsed = stored ? JSON.parse(stored) : null;
    if (parsed?.state?.theme === "dark") theme = "dark";
  } catch {
    theme = "light";
  }
  let lang: Language = DEFAULT_LANGUAGE;
  try {
    lang = toLanguage(window.localStorage.getItem("i18nextLng"));
  } catch {
    lang = DEFAULT_LANGUAGE;
  }
  return { theme, lang };
}

export const GLOBAL_ERROR_COPY: Record<Language, GlobalErrorCopy> = {
  la: {
    title: "Yummy Go ເປີດບໍ່ໄດ້",
    body: "ກະລຸນາລອງໃໝ່ອີກຄັ້ງ ຖ້າຍັງມີບັນຫາ ກະລຸນາຕິດຕໍ່ຝ່າຍຊ່ວຍເຫຼືອ",
    retry: "ລອງໃໝ່",
    reference: "ລະຫັດອ້າງອີງ",
  },
  en: {
    title: "Yummy Go could not load",
    body: "Retry the page. If the problem continues, contact support.",
    retry: "Try again",
    reference: "Reference",
  },
};
