"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import type { SceneApi } from "./scene-api";

export interface LandingEffectsRefs {
  rootRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  progressRef: RefObject<HTMLDivElement | null>;
  ringRef: RefObject<HTMLDivElement | null>;
  scrollHintRef: RefObject<HTMLDivElement | null>;
  backTopRef: RefObject<HTMLButtonElement | null>;
  /** ฉาก 3D ถือครองโดย useLandingScene — ที่นี่แค่ป้อนค่าสกรอลล์ให้ */
  sceneRef: RefObject<SceneApi | null>;
}

interface ParallaxElement {
  element: HTMLElement;
  speed: number;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

export function useLandingEffects(refs: LandingEffectsRefs): void {
  const { rootRef, canvasRef, progressRef, ringRef, scrollHintRef, backTopRef, sceneRef } = refs;

  useEffect(() => {
    const root = rootRef.current;
    const progress = progressRef.current;
    const ring = ringRef.current;
    const scrollHint = scrollHintRef.current;
    const backTop = backTopRef.current;
    if (!root) return;

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    let scrollFrame = 0;
    let pointerFrame = 0;
    let scrollEndTimer = 0;
    let pointerRectCache = new WeakMap<HTMLElement, DOMRect>();

    const parallaxElements: ParallaxElement[] = Array.from(
      root.querySelectorAll<HTMLElement>("[data-parallax]")
    ).map((element) => ({
      element,
      speed: Number.parseFloat(element.dataset.parallax ?? "0") || 0
    }));

    // scrollHeight เป็น forced synchronous layout — อ่านทุกเฟรมตอนสกรอลล์คือสาเหตุหลัก
    // ที่เฟรมตก จึงแคชไว้แล้วคำนวณใหม่เฉพาะตอนความสูงเอกสารเปลี่ยนจริง
    let scrollRange = 0;
    const measureScrollRange = () => {
      scrollRange = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
    };
    measureScrollRange();

    // เก็บค่าที่เขียนล่าสุดไว้ เพื่อไม่สั่ง style/attribute ซ้ำเมื่อค่าไม่เปลี่ยน
    let lastProgressScale = "";
    let lastHintOpacity = "";
    let lastCanvasOpacity = "";
    let lastBackTopVisible: boolean | null = null;

    const updateScrollEffects = () => {
      scrollFrame = 0;

      const scrollY = window.scrollY;
      const viewportHeight = Math.max(window.innerHeight, 1);
      const heroProgress = Math.min(scrollY / viewportHeight, 1);
      const totalProgress = scrollRange > 0 ? Math.min(scrollY / scrollRange, 1) : 0;
      const showBackTop = scrollY > 700;

      const progressScale = `scaleX(${totalProgress.toFixed(4)})`;
      if (progress && progressScale !== lastProgressScale) {
        progress.style.transform = progressScale;
        lastProgressScale = progressScale;
      }
      for (const { element, speed } of parallaxElements) {
        element.style.translate = `0 ${(scrollY * speed).toFixed(1)}px`;
      }
      const hintOpacity = scrollY > 60 ? "0" : "1";
      if (scrollHint && hintOpacity !== lastHintOpacity) {
        scrollHint.style.opacity = hintOpacity;
        lastHintOpacity = hintOpacity;
      }
      if (backTop && showBackTop !== lastBackTopVisible) {
        backTop.dataset.visible = String(showBackTop);
        backTop.tabIndex = showBackTop ? 0 : -1;
        backTop.setAttribute("aria-hidden", String(!showBackTop));
        lastBackTopVisible = showBackTop;
      }

      sceneRef.current?.onScroll(heroProgress, totalProgress);
      // อ่าน canvas ตอนใช้งานเสมอ เพราะการสลับ tier จะ remount <canvas> เป็น node ใหม่
      const canvas = canvasRef.current;
      if (canvas && root.dataset.sceneReady === "true") {
        const canvasOpacity = root.dataset.sceneActive === "true"
          ? Math.max(0.28, 1 - heroProgress * 0.72).toFixed(3)
          : "0.18";
        if (canvasOpacity !== lastCanvasOpacity) {
          canvas.style.opacity = canvasOpacity;
          lastCanvasOpacity = canvasOpacity;
        }
      }
    };

    const scheduleScrollEffects = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollEffects);
    };

    // ขณะสกรอลล์ ปิดเอฟเฟกต์ที่บังคับให้ compositor ผสมทั้งจอใหม่ทุกเฟรม (grain/cursor ring)
    // และให้ฉาก 3D ข้าม bloom — เฟรมเรตจะลงมาอยู่ระดับเดียวคงที่แทนที่จะกระตุกเป็นช่วง
    const endScroll = () => {
      scrollEndTimer = 0;
      root.dataset.scrolling = "false";
      sceneRef.current?.setScrolling(false);
    };

    const beginScroll = () => {
      if (!scrollEndTimer) {
        root.dataset.scrolling = "true";
        sceneRef.current?.setScrolling(true);
      } else {
        window.clearTimeout(scrollEndTimer);
      }
      scrollEndTimer = window.setTimeout(endScroll, 140);
    };

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          (entry.target as HTMLElement).dataset.inView = String(entry.isIntersecting);
        }
      },
      { rootMargin: "12% 0px 12%", threshold: 0.01 }
    );
    root.querySelectorAll<HTMLElement>("section").forEach((section) => sectionObserver.observe(section));

    const revealElements = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.dataset.revealed = "true";
          element.dataset.inView = "true";
          revealObserver.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 }
    );

    for (const element of revealElements) {
      if (reducedMotion) {
        element.dataset.revealed = "true";
        element.dataset.inView = "true";
      } else {
        element.dataset.inView = "false";
        revealObserver.observe(element);
      }
    }

    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      revealElements.forEach((element) => {
        element.dataset.revealed = "true";
        element.dataset.inView = "true";
      });
    };
    reducedMotionQuery.addEventListener("change", onReducedMotionChange);

    // ความสูงเอกสารเปลี่ยนได้จากรูปที่โหลดเสร็จหรือ layout ที่ปรับตัว — วัดใหม่เมื่อเปลี่ยนจริง
    // แทนที่จะอ่าน scrollHeight ทุกเฟรมสกรอลล์
    const documentObserver = new ResizeObserver(() => {
      measureScrollRange();
      scheduleScrollEffects();
    });
    documentObserver.observe(document.documentElement);

    const onScroll = () => {
      pointerRectCache = new WeakMap<HTMLElement, DOMRect>();
      beginScroll();
      scheduleScrollEffects();
    };
    const onResize = () => {
      pointerRectCache = new WeakMap<HTMLElement, DOMRect>();
      measureScrollRange();
      scheduleScrollEffects();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let ringX = pointerX;
    let ringY = pointerY;
    let ringScale = 1;
    let pointerTarget: Element | null = null;
    let activeMagnetic: HTMLElement | null = null;
    let activeTilt: HTMLElement | null = null;

    const getCachedRect = (element: HTMLElement | null) => {
      if (!element) return null;
      const cached = pointerRectCache.get(element);
      if (cached) return cached;
      const rect = element.getBoundingClientRect();
      pointerRectCache.set(element, rect);
      return rect;
    };

    const resetMagnetic = (element: HTMLElement | null) => {
      if (element) element.style.transform = "";
    };

    const resetTilt = (element: HTMLElement | null) => {
      if (!element) return;
      element.style.transform = "";
      element.dataset.tiltActive = "false";
      const glare = element.querySelector<HTMLElement>("[data-glare]");
      if (glare) {
        glare.style.opacity = "0";
        glare.style.background = "";
      }
    };

    const updatePointerEffects = () => {
      pointerFrame = 0;
      const target = pointerTarget;
      const nextMagnetic = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      const nextTilt = target?.closest<HTMLElement>("[data-tilt]") ?? null;
      const interactive = Boolean(target?.closest("a,button,input,textarea,[data-tilt]"));

      // Cache layout reads while the pointer stays over the same control/card.
      const magneticRect = getCachedRect(nextMagnetic);
      const tiltRect = getCachedRect(nextTilt);

      if (activeMagnetic !== nextMagnetic) resetMagnetic(activeMagnetic);
      if (activeTilt !== nextTilt) resetTilt(activeTilt);
      activeMagnetic = nextMagnetic;
      activeTilt = nextTilt;

      if (nextMagnetic && magneticRect) {
        const dx = pointerX - (magneticRect.left + magneticRect.width / 2);
        const dy = pointerY - (magneticRect.top + magneticRect.height / 2);
        nextMagnetic.style.transform = `translate(${(dx * 0.22).toFixed(1)}px,${(dy * 0.22).toFixed(1)}px)`;
      }

      if (nextTilt && tiltRect && tiltRect.width > 0 && tiltRect.height > 0) {
        const x = (pointerX - tiltRect.left) / tiltRect.width;
        const y = (pointerY - tiltRect.top) / tiltRect.height;
        nextTilt.dataset.tiltActive = "true";
        nextTilt.style.transform = `perspective(950px) rotateX(${((0.5 - y) * 6).toFixed(2)}deg) rotateY(${((x - 0.5) * 8).toFixed(2)}deg) translateY(-4px)`;
        const glare = nextTilt.querySelector<HTMLElement>("[data-glare]");
        if (glare) {
          glare.style.opacity = "1";
          glare.style.background = `radial-gradient(420px circle at ${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%, rgba(124,183,255,0.15), transparent 60%)`;
        }
      }

      if (!ring) return;
      const targetScale = interactive ? 1.7 : 1;
      ringX += (pointerX - ringX) * 0.2;
      ringY += (pointerY - ringY) * 0.2;
      ringScale += (targetScale - ringScale) * 0.18;
      ring.style.transform = `translate(${ringX.toFixed(1)}px,${ringY.toFixed(1)}px) translate(-50%,-50%) scale(${ringScale.toFixed(3)})`;

      const unsettled = Math.abs(pointerX - ringX) > 0.2
        || Math.abs(pointerY - ringY) > 0.2
        || Math.abs(targetScale - ringScale) > 0.002;
      if (unsettled) pointerFrame = requestAnimationFrame(updatePointerEffects);
    };

    const schedulePointerEffects = () => {
      if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointerEffects);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerTarget = event.target instanceof Element ? event.target : null;
      schedulePointerEffects();
    };

    const onPointerLeave = () => {
      if (ring) ring.style.opacity = "0";
      pointerTarget = null;
      resetMagnetic(activeMagnetic);
      resetTilt(activeTilt);
      activeMagnetic = null;
      activeTilt = null;
    };

    const onPointerEnter = () => {
      if (ring) ring.style.opacity = "1";
    };

    const pointerEffectsEnabled = window.matchMedia(FINE_POINTER_QUERY).matches && !reducedMotion;
    if (pointerEffectsEnabled) {
      document.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
      document.documentElement.addEventListener("pointerenter", onPointerEnter);
    }

    // ต้นฉบับใน Claude Design ตั้ง `html { scroll-behavior: smooth }` ให้ลิงก์ใน header
    // เลื่อนนุ่ม — ตั้งจาก JS เพื่อจำกัดผลไว้เฉพาะหน้านี้ ไม่ให้รั่วไปกวนสกรอลล์ของ POS
    const documentElement = document.documentElement;
    const previousScrollBehavior = documentElement.style.scrollBehavior;
    if (!reducedMotion) documentElement.style.scrollBehavior = "smooth";

    scheduleScrollEffects();

    return () => {
      documentElement.style.scrollBehavior = previousScrollBehavior;
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      if (scrollEndTimer) window.clearTimeout(scrollEndTimer);
      documentObserver.disconnect();
      sectionObserver.disconnect();
      revealObserver.disconnect();
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (pointerEffectsEnabled) {
        document.removeEventListener("pointermove", onPointerMove);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        document.documentElement.removeEventListener("pointerenter", onPointerEnter);
      }
      resetMagnetic(activeMagnetic);
      resetTilt(activeTilt);
    };
  }, [rootRef, canvasRef, progressRef, ringRef, scrollHintRef, backTopRef, sceneRef]);
}
