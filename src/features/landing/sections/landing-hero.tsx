"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { RefObject } from "react";
import type { Language } from "@/lib/language";
import { landingCompany, landingFeatures, landingPlatforms, pickText, REPORT_COUNT } from "../landing-data";
import { landingUi } from "../landing-ui";
import { createParticleStyles } from "../landing-particles";
import styles from "../landing.module.css";

interface LandingHeroProps {
  language: Language;
  heroRef: RefObject<HTMLElement | null>;
  scrollHintRef: RefObject<HTMLDivElement | null>;
}

export function LandingHero({
  language,
  heroRef,
  scrollHintRef
}: LandingHeroProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [animatedProgress, setAnimatedProgress] = useState(0);
  // เปิดโหมดลดการเคลื่อนไหว = ข้ามไปค่าปลายทางเลย ไม่ต้องนับ
  const countProgress = reducedMotion ? 1 : animatedProgress;
  const particles = useMemo(() => createParticleStyles(), []);
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);

  useEffect(() => {
    if (reducedMotion) return;

    const startedAt = performance.now();
    let frame = 0;
    let previousStep = -1;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 1500);
      const eased = 1 - Math.pow(1 - progress, 3);
      const step = Math.round(eased * 30);
      if (step !== previousStep) {
        previousStep = step;
        setAnimatedProgress(eased);
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const taglineWords = pickText(landingCompany.tagline, language).split(" ");
  const stats = [
    { value: String(Math.round(countProgress * landingFeatures.length)), label: text("statFeatures") },
    { value: String(Math.round(countProgress * landingPlatforms.length)), label: text("statPlatforms") },
    { value: String(Math.round(countProgress * REPORT_COUNT)), label: text("statReports") }
  ];

  return (
    <section ref={heroRef} id="top" className={styles.hero} data-in-view="true">
      <div data-parallax="0.25" className={styles.heroGlow} />
      <div className={styles.orbA} />
      <div className={styles.orbB} />

      {/* particle แบบ DOM ใช้ชั่วคราวจนกว่าฉาก WebGL จะพร้อม */}
      <div className={styles.particleLayer} aria-hidden="true">
        {particles.map((style, index) => (
          <div key={index} className={styles.particle} style={style} />
        ))}
      </div>

      {/* แผงกระจกลอย (เฉพาะเดสก์ท็อป) */}
      <div className={styles.floatLayer} aria-hidden="true">
          <div className={`${styles.glassPanel} ${styles.panelChart}`}>
            <div className={styles.panelDots}>
              <div className={styles.panelDot} />
              <div className={`${styles.panelDot} ${styles.panelDotMid}`} />
              <div className={`${styles.panelDot} ${styles.panelDotDim}`} />
            </div>
            <div className={styles.chartBars}>
              <div className={styles.chartBar} style={{ height: "40%" }} />
              <div className={styles.chartBar} style={{ height: "70%" }} />
              <div className={styles.chartBar} style={{ height: "52%" }} />
              <div className={`${styles.chartBar} ${styles.chartBarHot}`} style={{ height: "92%" }} />
              <div className={styles.chartBar} style={{ height: "64%" }} />
            </div>
            <div className={styles.chartLine} />
            <div className={styles.chartLineShort} />
          </div>

          <div className={`${styles.glassPanel} ${styles.panelMobile}`}>
            <div className={styles.mobileNotch} />
            <div className={styles.mobileScreen} />
            <div className={styles.mobileLine} />
            <div className={styles.mobileLineShort} />
          </div>
      </div>

      <div className={styles.heroContent}>
        <div className={styles.heroBadge}>
          <span className={styles.badgeDot} />
          {text("heroBadge")}
        </div>
        <h1 className={styles.heroTitle}>
          {taglineWords.map((word, index) => (
            // key รวมภาษาไว้เพื่อให้แอนิเมชันคำเริ่มใหม่เมื่อสลับภาษา
            <span key={`${language}-${index}`} className={styles.word} style={{ animationDelay: `${index * 0.07}s` }}>
              {word}
            </span>
          ))}
        </h1>
        <p className={styles.heroDesc}>{pickText(landingCompany.description, language)}</p>
        <div className={styles.heroActions}>
          <a href="#trial" className={styles.btnPrimary} data-magnetic>
            {text("btnTrial")}
          </a>
          <a href="#features" className={styles.btnGhost} data-magnetic>
            {text("btnFeatures")}
          </a>
          <a href="#trial" className={styles.btnLink}>
            {text("btnContact")} →
          </a>
        </div>
        <div className={styles.heroStats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
        <div className={styles.interactHint}>✦ {text("interactHint")}</div>
      </div>

      <div ref={scrollHintRef} className={styles.scrollHint}>
        <div className={styles.wheel}>
          <div className={styles.wheelDot} />
        </div>
        <div className={styles.scrollHintLabel}>{text("scrollHint")}</div>
      </div>
    </section>
  );
}
