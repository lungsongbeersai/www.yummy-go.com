"use client";

import type { Language } from "@/lib/language";
import { landingSteps, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingSteps({ language }: LandingSectionProps) {
  return (
    <section id="steps" className={`${styles.section} ${styles.sectionNarrow}`}>
      <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
        <div className={styles.kicker}>{pickText(landingUi.stepsKicker, language)}</div>
        <h2 className={styles.sectionTitle}>{pickText(landingUi.stepsTitle, language)}</h2>
      </div>
      <ol data-reveal className={`${styles.reveal} ${styles.stepsRow}`}>
        {landingSteps.map((step, index) => (
          <li key={step.id} className={styles.stepCard}>
            <div className={styles.stepNumber}>{index + 1}</div>
            <div className={styles.stepTitle}>{pickText(step.title, language)}</div>
            <div className={styles.stepDesc}>{pickText(step.description, language)}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
