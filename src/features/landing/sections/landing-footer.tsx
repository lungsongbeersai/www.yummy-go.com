"use client";

import Image from "next/image";
import type { Language } from "@/lib/language";
import { landingCompany, landingProjects, landingServices, landingUi, pickText } from "../landing-data";
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
            <div className={styles.footerColLabel}>{text("footerProjects")}</div>
            {landingProjects.map((project) => (
              <a key={project.id} href="#projects" className={styles.footerLink}>
                {project.name}
              </a>
            ))}
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerColLabel}>{text("footerServices")}</div>
            {landingServices.slice(0, 4).map((service) => (
              <a key={service.id} href="#services" className={styles.footerLink}>
                {pickText(service.title, language)}
              </a>
            ))}
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerColLabel}>{text("footerContact")}</div>
            <div className={styles.footerTba}>{text("placeholderTba")}</div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          © {year} {landingCompany.name}. {text("copyrightSuffix")}
        </div>
      </div>
    </footer>
  );
}
