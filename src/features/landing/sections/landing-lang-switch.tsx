"use client";

import type { Language } from "@/lib/language";
import styles from "../landing.module.css";

interface LandingLangSwitchProps {
  language: Language;
  onSetLanguage: (language: Language) => void;
  className?: string;
}

// ปุ่มสลับภาษา ລາວ/EN ของหน้า landing — ผูกกับภาษาเดียวกับทั้งแอป (app-store)
export function LandingLangSwitch({ language, onSetLanguage, className }: LandingLangSwitchProps) {
  const buttonClass = (active: boolean) => (active ? `${styles.langBtn} ${styles.langBtnActive}` : styles.langBtn);
  return (
    <div className={className ? `${styles.langSwitch} ${className}` : styles.langSwitch}>
      <button type="button" onClick={() => onSetLanguage("la")} className={buttonClass(language === "la")}>
        LA
      </button>
      <button type="button" onClick={() => onSetLanguage("en")} className={buttonClass(language === "en")}>
        EN
      </button>
    </div>
  );
}
