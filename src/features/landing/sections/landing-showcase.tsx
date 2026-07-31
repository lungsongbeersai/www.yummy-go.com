"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
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
    <section id="showcase" className={`${styles.section} ${styles.sectionProjects}`}>
      <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
        <div className={styles.kicker}>{text("showcaseKicker")}</div>
        <h2 className={styles.sectionTitle}>{text("showcaseTitle")}</h2>
      </div>
      <div className={styles.projectsGrid}>
        {landingShowcase.map((item) => (
          // projectCard มี transition ของตัวเอง (รวม opacity สำหรับ reveal แล้ว) จึงไม่ใส่ class reveal ซ้ำ
          <article key={item.id} data-reveal data-tilt className={styles.projectCard}>
            <Link
              href={loginHref}
              className={styles.projectCardLink}
              aria-label={`${text("btnLogin")}: ${pickText(item.caption, language)}`}
            />
            <div className={styles.projectOrb} />
            <div data-glare className={styles.glare} />
            <div className={`${styles.projectShot} ${styles.projectShotWithImage}`}>
              <Image
                src={item.image}
                alt={item.alt}
                fill
                quality={72}
                sizes="(max-width: 800px) 90vw, 45vw"
                className={styles.projectImage}
              />
            </div>
            <div className={styles.projectBody}>
              <div className={styles.projectCaption}>{pickText(item.caption, language)}</div>
            </div>
          </article>
        ))}
      </div>
      <div data-reveal className={`${styles.reveal} ${styles.showcaseActions}`}>
        <a href={loginHref} className={styles.btnSmallPrimary}>
          {text("btnLoginNow")}
        </a>
        <a href="#trial" className={styles.btnSmallLink}>
          {text("btnAskTrial")} →
        </a>
      </div>
    </section>
  );
}
