"use client";

import type { Language } from "@/lib/language";
import { landingServices, landingUi, pickText } from "../landing-data";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingServices({ language }: LandingSectionProps) {
  return (
    <section id="services" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInner}>
        <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
          <div className={styles.kicker}>{pickText(landingUi.servicesKicker, language)}</div>
          <h2 className={styles.sectionTitle}>{pickText(landingUi.servicesTitle, language)}</h2>
        </div>
        <div data-reveal className={`${styles.reveal} ${styles.servicesGrid}`}>
          {landingServices.map((service) => (
            <div key={service.id} data-tilt className={styles.serviceCard}>
              <div className={styles.cardTopLine} />
              <div data-glare className={styles.glare} />
              <div className={styles.serviceIcon}>{service.icon}</div>
              <div className={styles.serviceTitle}>{pickText(service.title, language)}</div>
              <div className={styles.serviceDesc}>{pickText(service.description, language)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
