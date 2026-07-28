"use client";

import type { Route } from "next";
import { useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { landingUi, pickText } from "./landing-data";
import styles from "./landing.module.css";
import { useLandingEffects } from "./use-landing-effects";
import { useLandingScene } from "./use-landing-scene";
import { LandingAbout } from "./sections/landing-about";
import { LandingContact } from "./sections/landing-contact";
import { LandingFooter } from "./sections/landing-footer";
import { LandingHeader } from "./sections/landing-header";
import { LandingHero } from "./sections/landing-hero";
import { LandingProjects } from "./sections/landing-projects";
import { LandingServices } from "./sections/landing-services";
import { LandingTutorials } from "./sections/landing-tutorials";
import { LandingTechnology, LandingWhy } from "./sections/landing-why-tech";

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
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const backTopRef = useRef<HTMLButtonElement>(null);

  const { sceneRef, tier, canvasKey, subscribeStats } = useLandingScene({
    rootRef,
    heroRef,
    canvasRef
  });

  useLandingEffects({
    rootRef,
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
      {/* ฉาก WebGL แบบโต้ตอบได้ (fixed อยู่หลังทุกอย่าง)
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
        <LandingHero
          language={language}
          heroRef={heroRef}
          scrollHintRef={scrollHintRef}
        />
        <LandingAbout language={language} />
        <LandingServices language={language} />
        <LandingProjects language={language} loginHref={loginHref} />
        <LandingTutorials language={language} />
        <LandingWhy language={language} />
        <LandingTechnology language={language} />
        <LandingContact language={language} />
        <LandingFooter language={language} onSetLanguage={setLanguage} />
      </div>
    </div>
  );
}
