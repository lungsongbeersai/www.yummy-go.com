"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Language } from "@/lib/language";
import { landingCompany, landingNavigation, landingUi, pickText } from "../landing-data";
import styles from "../landing.module.css";
import { LandingLangSwitch } from "./landing-lang-switch";

interface LandingHeaderProps {
  language: Language;
  onSetLanguage: (language: Language) => void;
  loginHref: string;
}

export function LandingHeader({
  language,
  onSetLanguage,
  loginHref
}: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 820px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <>
      <header className={styles.header}>
        <a href="#top" className={styles.brand}>
          <Image
            src={landingCompany.logo}
            alt="PLC Lao Developer logo"
            width={46}
            height={46}
            className={styles.brandLogo}
          />
          <span className={styles.brandName}>{landingCompany.name}</span>
        </a>
        <div className={styles.headerSpacer} />
        <nav className={styles.nav}>
          {landingNavigation.map((item) => (
            <a key={item.id} href={item.href} className={styles.navLink}>
              {pickText(item.label, language)}
            </a>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <LandingLangSwitch language={language} onSetLanguage={onSetLanguage} />
          <Link href={loginHref} className={styles.loginBtn} data-magnetic>
            {text("btnLogin")}
          </Link>
          <a href="#contact" className={styles.navCta} data-magnetic>
            {text("navCta")}
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            className={styles.menuBtn}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div id="landing-mobile-menu" className={styles.mobileMenu}>
          <nav className={styles.mobileNav}>
            {landingNavigation.map((item) => (
              <a key={item.id} href={item.href} onClick={() => setMenuOpen(false)} className={styles.mobileLink}>
                {pickText(item.label, language)}
              </a>
            ))}
            <Link href={loginHref} onClick={() => setMenuOpen(false)} className={styles.mobileLogin}>
              {text("btnLogin")}
            </Link>
            <a href="#contact" onClick={() => setMenuOpen(false)} className={styles.mobileCta}>
              {text("navCta")}
            </a>
          </nav>
        </div>
      ) : null}
    </>
  );
}
