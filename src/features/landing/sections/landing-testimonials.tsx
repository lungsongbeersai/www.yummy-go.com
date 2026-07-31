"use client";

import type { Language } from "@/lib/language";
import { landingTestimonials, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingTestimonials({ language }: LandingSectionProps) {
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);

  if (!landingTestimonials.length) return null;

  return (
    <section id="testimonials" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInner}>
        <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
          <div className={styles.kicker}>{text("testimonialsKicker")}</div>
          <h2 className={styles.sectionTitle}>{text("testimonialsTitle")}</h2>
        </div>
        <div data-reveal className={`${styles.reveal} ${styles.testimonialsGrid}`}>
          {landingTestimonials.map((item) => {
            const quote = pickText(item.quote, language).trim();

            // ยังไม่มีรีวิวจริง = โชว์โครงว่างพร้อมป้าย ไม่แต่งคำพูดของลูกค้าที่ไม่มีตัวตน
            if (!quote) {
              return (
                <figure key={item.id} className={`${styles.testimonialCard} ${styles.testimonialCardSoon}`}>
                  <div className={styles.cardTopLine} />
                  <span className={styles.testimonialSoon}>{text("contentSoon")}</span>
                  <div className={styles.testimonialSkeleton} aria-hidden>
                    <span className={styles.skeletonLine} />
                    <span className={styles.skeletonLine} />
                    <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                  </div>
                </figure>
              );
            }

            return (
              <figure key={item.id} data-tilt className={styles.testimonialCard}>
                <div className={styles.cardTopLine} />
                <div data-glare className={styles.glare} />
                <blockquote className={styles.testimonialQuote}>{quote}</blockquote>
                <figcaption className={styles.testimonialWho}>
                  <span className={styles.testimonialName}>{item.name}</span>
                  <span className={styles.testimonialShop}>{item.shop}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
