"use client";

import Image from "next/image";
import type { Language } from "@/lib/language";
import { landingCompany, landingFeatures, landingPlatforms, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";
import { LandingLangSwitch } from "./landing-lang-switch";

interface LandingFooterProps {
  language: Language;
  onSetLanguage: (language: Language) => void;
}

export function LandingFooter({ language, onSetLanguage }: LandingFooterProps) {
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrandCol}>
            <div className={styles.footerBrandRow}>
              <Image
                src={landingCompany.logo}
                alt={`${landingCompany.name} logo`}
                width={46}
                height={46}
                className={styles.brandLogo}
              />
              <span className={styles.footerBrandName}>{landingCompany.name}</span>
            </div>
            <p className={styles.footerDesc}>{text("footerDesc")}</p>
            <LandingLangSwitch language={language} onSetLanguage={onSetLanguage} className={styles.footerLangSwitch} />
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerColLabel}>{text("footerFeatures")}</div>
            {landingFeatures.slice(0, 5).map((feature) => (
              <a key={feature.id} href="#features" className={styles.footerLink}>
                {pickText(feature.title, language)}
              </a>
            ))}
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerColLabel}>{text("footerPlatforms")}</div>
            {landingPlatforms.map((platform) => (
              <a key={platform.id} href="#platforms" className={styles.footerLink}>
                {pickText(platform.label, language)}
              </a>
            ))}
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerColLabel}>{text("footerTrial")}</div>
            <a href="#trial" className={styles.footerLink}>
              {text("btnAskTrial")}
            </a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          © {year} {landingCompany.name}. {text("copyrightSuffix")}
        </div>
      </div>
    </footer>
  );
}
