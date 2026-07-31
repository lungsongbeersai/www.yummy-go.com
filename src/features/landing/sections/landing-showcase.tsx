"use client";

import type { Route } from "next";
import Image from "next/image";
import type { Language } from "@/lib/language";
import { landingShowcase, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingShowcaseProps {
  language: Language;
  loginHref: Route;
}

export function LandingShowcase({ language, loginHref }: LandingShowcaseProps) {
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);

  return (
    // ไม่มีหัวข้อกำกับ — แบนเนอร์มีแบรนด์ tagline และฟีเจอร์ครบในตัวอยู่แล้ว
    // ใส่หัวข้อจะไปแข่งกับข้อความในรูปเอง
    <section id="showcase" className={`${styles.section} ${styles.sectionProjects}`}>
      <div className={styles.projectsGrid}>
        {/* projectCard มี transition ของตัวเอง (รวม opacity สำหรับ reveal แล้ว) จึงไม่ใส่ class reveal ซ้ำ */}
        <article data-reveal data-tilt className={styles.projectCard}>
          {/* ในรูปมีปุ่ม "ເລີ່ມໃຊ້ງານດຽວນີ້" วาดติดมา ซึ่งกดไม่ได้จริง
              คลุมทั้งการ์ดด้วยลิงก์ไปฟอร์มขอทดลองใช้ เพื่อให้กดตรงปุ่มในรูปแล้วได้ผล */}
          <a href="#trial" className={styles.projectCardLink} aria-label={text("btnAskTrial")} />
          <div className={styles.projectOrb} />
          <div data-glare className={styles.glare} />
          <div className={`${styles.projectShot} ${styles.projectShotWithImage}`}>
            <Image
              src={landingShowcase.image}
              alt={landingShowcase.alt}
              fill
              quality={75}
              sizes="(max-width: 800px) 92vw, 1068px"
              className={styles.projectImage}
            />
          </div>
        </article>
      </div>
      <div data-reveal className={`${styles.reveal} ${styles.showcaseActions}`}>
        <a href="#trial" className={styles.btnSmallPrimary}>
          {text("btnAskTrial")}
        </a>
        <a href={loginHref} className={styles.btnSmallLink}>
          {text("btnLoginNow")} →
        </a>
      </div>
    </section>
  );
}
