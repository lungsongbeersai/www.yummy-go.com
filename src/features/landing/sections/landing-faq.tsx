"use client";

import type { Language } from "@/lib/language";
import { landingFaq, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingFaq({ language }: LandingSectionProps) {
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);

  if (!landingFaq.length) return null;

  return (
    <section id="faq" className={`${styles.section} ${styles.sectionNarrow}`}>
      <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
        <div className={styles.kicker}>{text("faqKicker")}</div>
        <h2 className={styles.sectionTitle}>{text("faqTitle")}</h2>
      </div>
      <div data-reveal className={`${styles.reveal} ${styles.faqList}`}>
        {/* details/summary เป็น accordion ของเบราว์เซอร์เอง — คีย์บอร์ดและ screen reader
            ใช้งานได้ครบโดยไม่ต้องเขียน JS หรือจัดการ aria เพิ่ม */}
        {landingFaq.map((item) => {
          const answer = pickText(item.answer, language).trim();

          return (
            <details key={item.id} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                <span>{pickText(item.question, language)}</span>
                {answer ? null : <span className={styles.faqSoon}>{text("contentSoon")}</span>}
                <span aria-hidden="true" className={styles.faqMark} />
              </summary>
              <div className={answer ? styles.faqAnswer : `${styles.faqAnswer} ${styles.faqAnswerSoon}`}>
                {answer || text("contentSoon")}
              </div>
            </details>
          );
        })}
      </div>
      <div data-reveal className={`${styles.reveal} ${styles.faqMore}`}>
        <span>{text("faqMoreQuestions")}</span>
        <a href="#trial" className={styles.btnSmallLink}>
          {text("faqMoreCta")} →
        </a>
      </div>
    </section>
  );
}
