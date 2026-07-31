"use client";

import type { Language } from "@/lib/language";
import { landingTestimonials, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingTestimonials({ language }: LandingSectionProps) {
  // ยังไม่มีรีวิวจากลูกค้าจริง = ซ่อนทั้ง section
  // หน้าการตลาดไม่ควรโชว์กล่องรีวิวเปล่า และห้ามแต่งรีวิวปลอมเด็ดขาด
  if (!landingTestimonials.length) return null;

  return (
    <section id="testimonials" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInner}>
        <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
          <div className={styles.kicker}>{pickText(landingUi.testimonialsKicker, language)}</div>
          <h2 className={styles.sectionTitle}>{pickText(landingUi.testimonialsTitle, language)}</h2>
        </div>
        <div data-reveal className={`${styles.reveal} ${styles.testimonialsGrid}`}>
          {landingTestimonials.map((item) => (
            <figure key={item.id} data-tilt className={styles.testimonialCard}>
              <div className={styles.cardTopLine} />
              <div data-glare className={styles.glare} />
              <blockquote className={styles.testimonialQuote}>{pickText(item.quote, language)}</blockquote>
              <figcaption className={styles.testimonialWho}>
                <span className={styles.testimonialName}>{item.name}</span>
                <span className={styles.testimonialShop}>{item.shop}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
