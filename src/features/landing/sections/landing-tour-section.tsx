"use client";

import type { RefObject } from "react";
import type { Language } from "@/lib/language";
import { landingCompany, landingFeatures, landingPlatforms, pickText, REPORT_COUNT } from "../landing-data";
import { LANDING_TOUR_FEATURE_STOPS, LANDING_TOUR_STOPS, type LandingTourFeatureStop } from "../landing-tour";
import { landingUi, type LandingUiKey } from "../landing-ui";
import styles from "../landing.module.css";

const TRY_TEXT: Record<LandingTourFeatureStop, LandingUiKey> = {
  tables: "tourTryTables",
  qr: "tourTryQr",
  print: "tourTryPrint",
  counter: "tourTryCounter",
  reports: "tourTryReports"
};

interface LandingTourSectionProps {
  language: Language;
  tourRef: RefObject<HTMLElement | null>;
  scrollHintRef: RefObject<HTMLDivElement | null>;
  tooltipRef: RefObject<HTMLDivElement | null>;
  onJump: (index: number) => void;
}

/**
 * section แรกของหน้า: ทัวร์ร้านอาหาร 3D — จุดแรกคือหัวหน้าเว็บ (tagline + ปุ่มหลัก)
 * จุดที่เหลือคือฟีเจอร์จริงจาก landingFeatures ทีละอย่าง ข้อความทุกใบอยู่ใน DOM ตลอด
 * (screen reader อ่านได้ครบ) แค่ซ่อน/แสดงด้วย data-active ที่ use-landing-effects ตั้งให้
 */
export function LandingTourSection({ language, tourRef, scrollHintRef, tooltipRef, onJump }: LandingTourSectionProps) {
  const text = (key: LandingUiKey) => pickText(landingUi[key], language);
  const featureById = new Map(landingFeatures.map((feature) => [feature.id, feature]));
  const taglineWords = pickText(landingCompany.tagline, language).split(" ");
  const total = LANDING_TOUR_FEATURE_STOPS.length;
  const stats = [
    { value: String(landingFeatures.length), label: text("statFeatures") },
    { value: String(landingPlatforms.length), label: text("statPlatforms") },
    { value: String(REPORT_COUNT), label: text("statReports") }
  ];

  const stopLabel = (stop: (typeof LANDING_TOUR_STOPS)[number]) => {
    if (stop === "intro") return text("tourStopIntro");
    const feature = featureById.get(stop);
    return feature ? pickText(feature.title, language) : stop;
  };

  return (
    <section ref={tourRef} id="top" className={styles.tour} data-in-view="true">
      <div className={styles.tourSticky}>
        <div className={styles.tourPoster} aria-hidden="true" />
        <div className={styles.tourVignette} aria-hidden="true" />

        <div data-tour-intro className={styles.tourIntro}>
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

        <ol className={styles.tourCards} aria-label={text("tourRailLabel")}>
          {LANDING_TOUR_FEATURE_STOPS.map((stop, index) => {
            const feature = featureById.get(stop);
            if (!feature) return null;
            return (
              <li key={stop} data-tour-card={stop} data-active="false" className={styles.tourCard}>
                <span className={styles.tourCardIndex}>
                  {pickText(landingUi.tourStep, language)
                    .replace("{current}", String(index + 1))
                    .replace("{total}", String(total))}
                </span>
                <h2 className={styles.tourCardTitle}>{pickText(feature.title, language)}</h2>
                <p className={styles.tourCardText}>{pickText(feature.description, language)}</p>
                <p className={styles.tourCardTry}>{text(TRY_TEXT[stop])}</p>
              </li>
            );
          })}
        </ol>

        <nav className={styles.tourRail} aria-label={text("tourRailLabel")}>
          <ol data-tour-rail className={styles.tourRailList}>
            {LANDING_TOUR_STOPS.map((stop, index) => (
              <li key={stop}>
                <button
                  type="button"
                  data-tour-dot={stop}
                  aria-current={index === 0 ? "step" : undefined}
                  className={styles.tourDot}
                  onClick={() => onJump(index)}
                >
                  <span className={styles.tourDotLabel}>{stopLabel(stop)}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* ป้ายชื่อวัตถุในฉาก — มีข้อความของทุกจุดรอไว้ CSS เลือกโชว์ตาม data-stop ไม่ต้อง re-render ตอนเมาส์ขยับ */}
        <div ref={tooltipRef} className={styles.tourTooltip} data-visible="false" data-stop="" data-table="false" aria-hidden="true">
          {LANDING_TOUR_FEATURE_STOPS.map((stop) => (
            <span key={stop} data-for={stop} className={styles.tooltipTitle}>
              {stopLabel(stop)}
            </span>
          ))}
          <span className={`${styles.tooltipAction} ${styles.tooltipActionOpen}`}>{text("tooltipOpen")}</span>
          <span className={`${styles.tooltipAction} ${styles.tooltipActionTable}`}>{text("tooltipTable")}</span>
        </div>

        <div ref={scrollHintRef} className={styles.scrollHint}>
          <div className={styles.wheel}>
            <div className={styles.wheelDot} />
          </div>
          <div className={styles.scrollHintLabel}>{text("scrollHint")}</div>
        </div>
      </div>
    </section>
  );
}
