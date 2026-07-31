"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Facebook, Mail, MapPin, Phone } from "lucide-react";
import type { Language } from "@/lib/language";
import { pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import { buildTrialLink, buildTrialMessage, landingContact } from "../trial-link";
import type { TrialRequest } from "../trial-link";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

const EMPTY_FORM: TrialRequest = {
  shopName: "",
  contactName: "",
  phone: "",
  shopType: "",
  branchCount: "1"
};

export function LandingTrial({ language }: LandingSectionProps) {
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);
  const [form, setForm] = useState<TrialRequest>(EMPTY_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [sent, setSent] = useState(false);

  const shopTypes = [
    text("shopTypeRestaurant"),
    text("shopTypeCafe"),
    text("shopTypeDrinks"),
    text("shopTypeOther")
  ];

  // ยังไม่ตั้งค่าช่องทางติดต่อ = ส่งคำขอไปไหนไม่ได้ ปิดปุ่มไว้ให้เห็นชัดแทนที่จะเงียบหาย
  const channelReady = buildTrialLink(landingContact, "probe", "probe") !== null;

  const missing = {
    shopName: !form.shopName.trim(),
    contactName: !form.contactName.trim(),
    phone: !form.phone.trim()
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (missing.shopName || missing.contactName || missing.phone) {
      setShowErrors(true);
      return;
    }

    const message = buildTrialMessage(
      { ...form, shopType: form.shopType || shopTypes[0] },
      {
        intro: text("trialIntro"),
        shopName: text("fieldShopName"),
        contactName: text("fieldContactName"),
        phone: text("fieldPhone"),
        shopType: text("fieldShopType"),
        branchCount: text("fieldBranchCount")
      }
    );
    const link = buildTrialLink(landingContact, message, text("trialIntro"));
    if (!link) return;

    window.open(link, "_blank", "noopener");
    setSent(true);
  };

  // โชว์ครบทุกช่องแม้ยังไม่ได้กรอก — ช่องว่างขึ้นป้าย "ໄວໆນີ້" แทนการซ่อน
  // เบอร์กับอีเมลกดโทร/กดส่งเมลได้เลย ที่อยู่ไม่มีปลายทางให้กด
  const contactSlots = [
    {
      label: text("contactPhoneLabel"),
      value: landingContact.phone,
      icon: Phone,
      href: landingContact.phone ? `tel:${landingContact.phone.replace(/\s/g, "")}` : ""
    },
    {
      label: text("contactEmailLabel"),
      value: landingContact.email,
      icon: Mail,
      href: landingContact.email ? `mailto:${landingContact.email}` : ""
    },
    { label: text("contactAddressLabel"), value: landingContact.address, icon: MapPin, href: "" }
  ];

  const requiredNote = text("fieldRequired");

  return (
    <section id="trial" className={`${styles.section} ${styles.sectionNarrow} ${styles.sectionContact}`}>
      <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
        <div className={styles.kicker}>{text("trialKicker")}</div>
        <h2 className={styles.contactTitle}>{text("trialTitle")}</h2>
        <p className={styles.contactSubtitle}>{text("trialSubtitle")}</p>
      </div>
      <div data-reveal className={`${styles.reveal} ${styles.contactGrid}`}>
        <form onSubmit={onSubmit} data-no-pulse className={styles.contactForm} noValidate>
          <label className={styles.formLabel}>
            {text("fieldShopName")}
            <input
              type="text"
              name="shopName"
              value={form.shopName}
              onChange={(event) => setForm({ ...form, shopName: event.target.value })}
              className={styles.field}
            />
            {showErrors && missing.shopName ? <span className={styles.formNote}>{requiredNote}</span> : null}
          </label>
          <label className={styles.formLabel}>
            {text("fieldContactName")}
            <input
              type="text"
              name="contactName"
              value={form.contactName}
              onChange={(event) => setForm({ ...form, contactName: event.target.value })}
              className={styles.field}
            />
            {showErrors && missing.contactName ? <span className={styles.formNote}>{requiredNote}</span> : null}
          </label>
          <label className={styles.formLabel}>
            {text("fieldPhone")}
            <input
              type="tel"
              name="phone"
              inputMode="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className={styles.field}
            />
            {showErrors && missing.phone ? <span className={styles.formNote}>{requiredNote}</span> : null}
          </label>
          <label className={styles.formLabel}>
            {text("fieldShopType")}
            <select
              name="shopType"
              value={form.shopType}
              onChange={(event) => setForm({ ...form, shopType: event.target.value })}
              className={styles.field}
            >
              {shopTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.formLabel}>
            {text("fieldBranchCount")}
            <input
              type="number"
              name="branchCount"
              min={1}
              value={form.branchCount}
              onChange={(event) => setForm({ ...form, branchCount: event.target.value })}
              className={styles.field}
            />
          </label>
          {sent ? <div className={styles.formNote}>{text("formSent")}</div> : null}
          <div className={styles.formActions}>
            <button type="submit" className={styles.btnSend} disabled={!channelReady} data-magnetic>
              {channelReady ? text("btnRequestTrial") : text("trialUnavailable")}
            </button>
          </div>
        </form>
        <div className={styles.contactCard}>
          <div className={styles.contactCardTitle}>{text("trialCardTitle")}</div>
          {contactSlots.map((slot) => {
            const Icon = slot.icon;
            const body = (
              <>
                <Icon aria-hidden className={styles.slotIcon} />
                <span>{slot.value || text("contentSoon")}</span>
              </>
            );

            return (
              <div key={slot.label} className={styles.contactSlot}>
                <div className={styles.slotLabel}>{slot.label}</div>
                {slot.href ? (
                  <a href={slot.href} className={`${styles.slotValue} ${styles.slotValueLink}`}>
                    {body}
                  </a>
                ) : (
                  <div className={slot.value ? styles.slotValue : `${styles.slotValue} ${styles.slotValueSoon}`}>
                    {body}
                  </div>
                )}
              </div>
            );
          })}
          <div className={styles.socialRow}>
            <div className={styles.slotLabel}>{text("contactSocialLabel")}</div>
            {landingContact.facebook ? (
              <a
                href={landingContact.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialSquare}
                aria-label="Facebook"
              >
                <Facebook aria-hidden className={styles.socialIcon} />
              </a>
            ) : (
              <div className={`${styles.socialSquare} ${styles.socialSquareSoon}`} aria-hidden>
                <Facebook className={styles.socialIcon} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
