"use client";

import type { Language } from "@/lib/language";
import { landingPlatforms, landingWhyChooseUs, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingWhy({ language }: LandingSectionProps) {
  return (
    <section id="why" className={`${styles.section} ${styles.sectionNarrow}`}>
      <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
        <div className={styles.kicker}>{pickText(landingUi.whyKicker, language)}</div>
        <h2 className={styles.sectionTitle}>{pickText(landingUi.whyTitle, language)}</h2>
      </div>
      <div data-reveal className={`${styles.reveal} ${styles.whyRow}`}>
        {landingWhyChooseUs.map((item) => (
          <div key={item.id} className={styles.whyCard}>
            <div className={styles.whyIcon}>{item.icon}</div>
            <div className={styles.whyTitle}>{pickText(item.title, language)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingPlatforms({ language }: LandingSectionProps) {
  return (
    <section id="platforms" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInnerNarrow}>
        <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`} style={{ marginBottom: 48 }}>
          <div className={styles.kicker}>{pickText(landingUi.platformsKicker, language)}</div>
          <h2 className={styles.sectionTitle}>{pickText(landingUi.platformsTitle, language)}</h2>
        </div>
        <div data-reveal className={`${styles.reveal} ${styles.techRow}`}>
          {landingPlatforms.map((platform, index) => (
            <div
              key={platform.id}
              className={styles.techPill}
              style={{ animationDuration: `${5 + (index % 4)}s`, animationDelay: `${index * -0.7}s` }}
            >
              <span className={styles.techIc}>ic</span>
              {pickText(platform.label, language)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
