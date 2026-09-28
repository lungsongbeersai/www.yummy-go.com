"use client";

import type { Route } from "next";
import { useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { pickText } from "./landing-data";
import { landingUi } from "./landing-ui";
import styles from "./landing.module.css";
import { useLandingEffects } from "./use-landing-effects";
import { useLandingScene } from "./use-landing-scene";
import { LANDING_TOUR_STOPS, tourScrollTarget, type LandingTourFeatureStop } from "./landing-tour";
import type { SceneHotspotEvent } from "./scene-api";
import { LandingAbout } from "./sections/landing-about";
import { LandingFeatures } from "./sections/landing-features";
import { LandingFooter } from "./sections/landing-footer";
import { LandingHeader } from "./sections/landing-header";
import { LandingPricing } from "./sections/landing-pricing";
import { LandingShowcase } from "./sections/landing-showcase";
import { LandingSteps } from "./sections/landing-steps";
import { LandingTestimonials } from "./sections/landing-testimonials";
import { LandingTrial } from "./sections/landing-trial";
import { LandingTourSection } from "./sections/landing-tour-section";
import { LandingTutorials } from "./sections/landing-tutorials";
import { LandingFaq } from "./sections/landing-faq";
import { LandingPlatforms } from "./sections/landing-platforms";

interface LandingPageProps {
  // class ตัวแปรฟอนต์ (Space Grotesk / JetBrains Mono) ส่งมาจาก route ซึ่งโหลดผ่าน next/font
  className?: string;
}

export function LandingPage({ className }: LandingPageProps) {
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  // คงค่า redirect เดิมไว้ เพื่อให้หลังล็อกอินกลับไปหน้าที่ผู้ใช้ตั้งใจเปิดตอนแรก
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const loginHref: Route = redirect
    ? (`/login?redirect=${encodeURIComponent(redirect)}` as Route)
    : "/login";

  const rootRef = useRef<HTMLDivElement>(null);
  const tourRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const backTopRef = useRef<HTMLButtonElement>(null);

  // กระโดดไปจุดทัวร์ = เลื่อนหน้าไปตำแหน่งที่ทำให้กล้องหยุดที่จุดนั้นพอดี (กล้องตามสกรอลล์เอง)
  const jumpToStop = useCallback((index: number) => {
    const tour = tourRef.current;
    if (!tour) return;
    const top = tour.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: tourScrollTarget(index, top, tour.offsetHeight, window.innerHeight) });
  }, []);

  const selectStop = useCallback(
    (stop: LandingTourFeatureStop) => jumpToStop(LANDING_TOUR_STOPS.indexOf(stop)),
    [jumpToStop]
  );

  // ฉากเรียกทุกเฟรมที่ป้ายขยับ — เขียน DOM ตรง ๆ ไม่ผ่าน state เพื่อไม่ re-render ทั้งหน้า 60 ครั้งต่อวินาที
  const showHotspot = useCallback((hotspot: SceneHotspotEvent | null) => {
    const tooltip = tooltipRef.current;
    const root = rootRef.current;
    if (root) root.dataset.hotspot = String(Boolean(hotspot));
    if (!tooltip) return;
    if (!hotspot) {
      tooltip.dataset.visible = "false";
      return;
    }
    tooltip.dataset.stop = hotspot.stop;
    tooltip.dataset.table = String(hotspot.table);
    tooltip.dataset.visible = "true";
    tooltip.style.transform = `translate(${hotspot.x}px, ${hotspot.y}px) translate(-50%, calc(-100% - 12px))`;
  }, []);

  const { sceneRef, tier, canvasKey, subscribeStats } = useLandingScene({
    rootRef,
    heroRef: tourRef,
    canvasRef,
    onHotspot: showHotspot,
    onSelect: selectStop
  });

  useLandingEffects({
    rootRef,
    tourRef,
    canvasRef,
    progressRef,
    ringRef,
    scrollHintRef,
    backTopRef,
    sceneRef
  });

  const backTopLabel = pickText(landingUi.backTop, language);

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.page} ${className}` : styles.page}
      data-scene-ready="false"
      data-scene-active="false"
    >
      {/* ฉากร้านอาหาร WebGL แบบโต้ตอบได้ (fixed อยู่หลังทุกอย่าง)
          key ผูกกับ tier เพราะ antialias ตั้งได้ตอนสร้าง WebGL context เท่านั้น
          และ forceContextLoss() ทำให้ขอ context ใหม่บน canvas เดิมไม่ได้ — ต้อง remount */}
      <canvas key={canvasKey} ref={canvasRef} className={styles.canvas3d} />
      <div ref={progressRef} className={styles.progressBar} />
      <div ref={ringRef} className={styles.cursorRing} />
      <div className={styles.grain} />

      <button
        ref={backTopRef}
        type="button"
        onClick={() => {
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
        }}
        aria-label={backTopLabel}
        title={backTopLabel}
        aria-hidden="true"
        tabIndex={-1}
        data-visible="false"
        className={styles.backTop}
      >
        ↑
      </button>

      <LandingHeader
        language={language}
        onSetLanguage={setLanguage}
        loginHref={loginHref}
        sceneTier={tier}
        subscribeSceneStats={subscribeStats}
      />

      <div className={styles.content}>
        <LandingTourSection
          language={language}
          tourRef={tourRef}
          scrollHintRef={scrollHintRef}
          tooltipRef={tooltipRef}
          onJump={jumpToStop}
        />
        {/* แบนเนอร์อยู่ติดใต้ hero — เป็นภาพโปรดักต์ภาพเดียวของหน้า ต้องมาก่อนที่จะเริ่มอธิบาย
            ส่วนราคามาท้าย ๆ หลังคนเห็นแล้วว่าได้อะไรบ้าง ไม่ใช่ขอเงินตั้งแต่ยังไม่เห็นของ */}
        <LandingShowcase language={language} loginHref={loginHref} />
        <LandingAbout language={language} />
        <LandingFeatures language={language} />
        <LandingPlatforms language={language} />
        <LandingSteps language={language} />
        {/* สามอันนี้ซ่อนตัวเองเมื่อยังไม่มีเนื้อหาจริง จึงวางไว้ได้เลยโดยหน้าไม่โหว่ */}
        <LandingTutorials language={language} />
        <LandingTestimonials language={language} />
        <LandingPricing language={language} />
        <LandingFaq language={language} />
        <LandingTrial language={language} />
        <LandingFooter language={language} onSetLanguage={setLanguage} />
      </div>
    </div>
  );
}
