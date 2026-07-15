"use client";

import Image from "next/image";
import Link from "next/link";
import type { Language } from "@/lib/language";
import { landingProjects, landingUi, pickText } from "../landing-data";
import styles from "../landing.module.css";

interface LandingProjectsProps {
  language: Language;
  loginHref: string;
}

export function LandingProjects({ language, loginHref }: LandingProjectsProps) {
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);

  return (
    <section id="projects" className={`${styles.section} ${styles.sectionProjects}`}>
      <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
        <div className={styles.kicker}>{text("projectsKicker")}</div>
        <h2 className={styles.sectionTitle}>{text("projectsTitle")}</h2>
      </div>
      <div className={styles.projectsGrid}>
        {landingProjects.map((project) => {
          const isYummyGo = project.id === "yummy-go";

          return (
            // projectCard มี transition ของตัวเอง (รวม opacity สำหรับ reveal แล้ว) จึงไม่ใส่ class reveal ซ้ำ
            <article key={project.id} data-reveal data-tilt className={styles.projectCard}>
              {isYummyGo ? (
                <Link
                  href={loginHref}
                  className={styles.projectCardLink}
                  aria-label={`${text("btnLogin")}: ${project.name}`}
                />
              ) : null}
              <div className={styles.projectOrb} />
              <div data-glare className={styles.glare} />
              <div className={`${styles.projectShot} ${isYummyGo ? styles.projectShotWithImage : ""}`}>
                {isYummyGo ? (
                  <Image
                    src="/landing/banner_project_yummy-go.webp"
                    alt="Yummy Go restaurant POS and ordering system on laptop and mobile devices"
                    fill
                    quality={60}
                    sizes="(max-width: 800px) 90vw, 45vw"
                    className={styles.projectImage}
                  />
                ) : (
                  <>
                    <div className={styles.shimmerWrap}>
                      <div className={styles.shimmerBar} />
                    </div>
                    <div className={styles.projectShotLabel}>
                      [ project screenshot ]
                      <br />
                      {project.name}
                    </div>
                  </>
                )}
              </div>
              <div className={styles.projectBody}>
                <div className={styles.projectHeadRow}>
                  <h3 className={styles.projectName}>{project.name}</h3>
                  <span className={styles.projectTag}>{pickText(project.category, language)}</span>
                </div>
                <p className={styles.projectDesc}>{pickText(project.description, language)}</p>
                <div className={styles.featureChips}>
                  {project.features[language].map((feature) => (
                    <span key={feature} className={styles.featureChip}>
                      {feature}
                    </span>
                  ))}
                </div>
                <div className={styles.projectActions}>
                  <a href={isYummyGo ? loginHref : "#contact"} className={styles.btnSmallPrimary}>
                    {text("btnViewProject")}
                  </a>
                  <a href="#tutorials" className={styles.btnSmallGhost}>
                    {text("btnWatchTutorial")}
                  </a>
                  <a href="#contact" className={styles.btnSmallLink}>
                    {text("btnRequestDemo")} →
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
