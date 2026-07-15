"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Language } from "@/lib/language";
import { landingCompany, landingUi, pickText } from "../landing-data";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingContact({ language }: LandingSectionProps) {
  const [sent, setSent] = useState(false);
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);

  // ยังไม่เชื่อม backend สำหรับฟอร์มติดต่อ — แสดงข้อความยืนยันตามดีไซน์ไว้ก่อน
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
  };

  const placeholder = text("placeholderTba");
  const slots = [
    { label: text("contactEmailLabel"), value: landingCompany.contactEmail || placeholder },
    { label: text("contactPhoneLabel"), value: landingCompany.phone || placeholder },
    { label: text("contactAddressLabel"), value: landingCompany.address || placeholder },
    { label: text("contactSocialLabel"), value: placeholder }
  ];

  return (
    <section id="contact" className={`${styles.section} ${styles.sectionNarrow} ${styles.sectionContact}`}>
      <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
        <div className={styles.kicker}>{text("contactKicker")}</div>
        <h2 className={styles.contactTitle}>{text("contactTitle")}</h2>
        <p className={styles.contactSubtitle}>{text("contactSubtitle")}</p>
      </div>
      <div data-reveal className={`${styles.reveal} ${styles.contactGrid}`}>
        <form onSubmit={onSubmit} data-no-pulse className={styles.contactForm}>
          <label className={styles.formLabel}>
            {text("fieldName")}
            <input type="text" name="name" className={styles.field} />
          </label>
          <label className={styles.formLabel}>
            {text("fieldEmail")}
            <input type="text" name="contact" className={styles.field} />
          </label>
          <label className={styles.formLabel}>
            {text("fieldMessage")}
            <textarea name="message" rows={5} className={`${styles.field} ${styles.fieldArea}`} />
          </label>
          {sent ? <div className={styles.formNote}>{text("formSent")}</div> : null}
          <div className={styles.formActions}>
            <button type="submit" className={styles.btnSend} data-magnetic>
              {text("btnSend")}
            </button>
            <button type="submit" className={styles.btnCustom}>
              {text("btnCustom")}
            </button>
          </div>
        </form>
        <div className={styles.contactCard}>
          <div className={styles.contactCardTitle}>{text("contactCardTitle")}</div>
          {slots.map((slot) => (
            <div key={slot.label} className={styles.contactSlot}>
              <div className={styles.slotLabel}>{slot.label}</div>
              <div className={styles.slotValue}>{slot.value}</div>
            </div>
          ))}
          <div className={styles.socialRow}>
            <div className={styles.socialSquare} />
            <div className={styles.socialSquare} />
            <div className={styles.socialSquare} />
            <div className={styles.socialSquare} />
          </div>
        </div>
      </div>
    </section>
  );
}
