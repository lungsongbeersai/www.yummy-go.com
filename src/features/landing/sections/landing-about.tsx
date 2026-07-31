"use client";

import type { Language } from "@/lib/language";
import { landingCompany, landingHighlights, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingAbout({ language }: LandingSectionProps) {
  return (
    <section id="about" className={`${styles.section} ${styles.sectionNarrow}`}>
      <div data-reveal className={`${styles.reveal} ${styles.aboutGrid}`}>
        <div>
          <div className={styles.kicker}>{pickText(landingUi.aboutKicker, language)}</div>
          <h2 className={styles.aboutTitle}>{pickText(landingUi.aboutTitle, language)}</h2>
          <p className={styles.aboutText}>{pickText(landingCompany.about, language)}</p>
        </div>
        <div className={styles.highlightsGrid}>
          {landingHighlights.map((item) => (
            <div key={item.id} className={styles.highlightCard}>
              <div className={styles.highlightIcon}>{item.icon}</div>
              <div className={styles.highlightTitle}>{pickText(item.title, language)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
