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
        {/* projectCard มี transition ของตัวเอง (รวม opacity สำหรับ reveal แล้ว) จึงไม่ใส่ class reveal ซ้ำ */}
        <article data-reveal data-tilt className={styles.projectCard}>
          <Link
            href={loginHref}
            className={styles.projectCardLink}
            aria-label={`${text("btnLogin")}: ${landingShowcase.alt}`}
          />
          <div className={styles.projectOrb} />
          <div data-glare className={styles.glare} />
          <div className={`${styles.projectShot} ${styles.projectShotWithImage}`}>
            <Image
              src={landingShowcase.image}
              alt={landingShowcase.alt}
              fill
              quality={60}
              sizes="(max-width: 800px) 90vw, 60vw"
              className={styles.projectImage}
            />
          </div>
          <div className={styles.projectBody}>
            <p className={styles.projectDesc}>{text("showcaseTitle")}</p>
            <div className={styles.featureChips}>
              {landingShowcase.points.map((point) => (
                <span key={point.en} className={styles.featureChip}>
                  {pickText(point, language)}
                </span>
              ))}
            </div>
            <div className={styles.projectActions}>
              <a href={loginHref} className={styles.btnSmallPrimary}>
                {text("btnLoginNow")}
              </a>
              <a href="#trial" className={styles.btnSmallLink}>
                {text("btnAskTrial")} →
              </a>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
