"use client";

import type { Language } from "@/lib/language";
import { landingFeatures, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingFeatures({ language }: LandingSectionProps) {
  return (
    <section id="features" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInner}>
        <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
          <div className={styles.kicker}>{pickText(landingUi.featuresKicker, language)}</div>
          <h2 className={styles.sectionTitle}>{pickText(landingUi.featuresTitle, language)}</h2>
        </div>
        <div data-reveal className={`${styles.reveal} ${styles.servicesGrid}`}>
          {landingFeatures.map((feature) => (
            <div key={feature.id} data-tilt className={styles.serviceCard}>
              <div className={styles.cardTopLine} />
              <div data-glare className={styles.glare} />
              <div className={styles.serviceIcon}>{feature.icon}</div>
              <div className={styles.serviceTitle}>{pickText(feature.title, language)}</div>
              <div className={styles.serviceDesc}>{pickText(feature.description, language)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
