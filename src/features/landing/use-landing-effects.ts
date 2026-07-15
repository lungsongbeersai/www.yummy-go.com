"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { SceneApi } from "./scene-api";

export interface LandingEffectsRefs {
  rootRef: RefObject<HTMLDivElement | null>;
  heroRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  progressRef: RefObject<HTMLDivElement | null>;
  ringRef: RefObject<HTMLDivElement | null>;
  scrollHintRef: RefObject<HTMLDivElement | null>;
  backTopRef: RefObject<HTMLButtonElement | null>;
}

interface ParallaxElement {
  element: HTMLElement;
  speed: number;
}

interface OptionalIdleWindow {
  requestIdleCallback?: Window["requestIdleCallback"];
  cancelIdleCallback?: Window["cancelIdleCallback"];
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

function scheduleIdle(callback: () => void): () => void {
  const idleWindow = window as unknown as OptionalIdleWindow;
  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 800 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, 1);
  return () => window.clearTimeout(handle);
}

export function useLandingEffects(refs: LandingEffectsRefs): void {
  const { rootRef, heroRef, canvasRef, progressRef, ringRef, scrollHintRef, backTopRef } = refs;
  const sceneRef = useRef<SceneApi | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const hero = heroRef.current;
    const canvas = canvasRef.current;
    const progress = progressRef.current;
    const ring = ringRef.current;
    const scrollHint = scrollHintRef.current;
    const backTop = backTopRef.current;
    if (!root || !hero || !canvas) return;

    let disposed = false;
    let reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    let heroVisible = false;
    let sceneLoadStarted = false;
    let cancelIdleSceneLoad: (() => void) | null = null;
    let scrollFrame = 0;
    let pointerFrame = 0;
    let pointerRectCache = new WeakMap<HTMLElement, DOMRect>();

    const parallaxElements: ParallaxElement[] = Array.from(
      root.querySelectorAll<HTMLElement>("[data-parallax]")
    ).map((element) => ({
      element,
      speed: Number.parseFloat(element.dataset.parallax ?? "0") || 0
    }));

    const setSceneActive = () => {
      const active = Boolean(sceneRef.current && heroVisible && !document.hidden && !reducedMotion);
      sceneRef.current?.setActive(active);
      root.dataset.sceneActive = String(active);
      if (!active && root.dataset.sceneReady === "true") canvas.style.opacity = "0.18";
    };

    const updateScrollEffects = () => {
      scrollFrame = 0;

      // Read layout first so the following style mutations can be batched by the browser.
      const scrollY = window.scrollY;
      const viewportHeight = Math.max(window.innerHeight, 1);
      const scrollRange = Math.max(document.documentElement.scrollHeight - viewportHeight, 0);
      const heroProgress = Math.min(scrollY / viewportHeight, 1);
      const totalProgress = scrollRange > 0 ? Math.min(scrollY / scrollRange, 1) : 0;
      const showBackTop = scrollY > 700;

      if (progress) progress.style.transform = `scaleX(${totalProgress.toFixed(4)})`;
      for (const { element, speed } of parallaxElements) {
        element.style.translate = `0 ${(scrollY * speed).toFixed(1)}px`;
      }
      if (scrollHint) scrollHint.style.opacity = scrollY > 60 ? "0" : "1";
      if (backTop) {
        backTop.dataset.visible = String(showBackTop);
        backTop.tabIndex = showBackTop ? 0 : -1;
        backTop.setAttribute("aria-hidden", String(!showBackTop));
      }

      sceneRef.current?.onScroll(heroProgress, totalProgress);
      if (root.dataset.sceneReady === "true") {
        canvas.style.opacity = root.dataset.sceneActive === "true"
          ? Math.max(0.28, 1 - heroProgress * 0.72).toFixed(3)
          : "0.18";
      }
    };

    const scheduleScrollEffects = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollEffects);
    };

    const loadScene = async () => {
      cancelIdleSceneLoad = null;
      if (disposed || reducedMotion || !heroVisible || sceneLoadStarted || sceneRef.current) return;
      sceneLoadStarted = true;

      try {
        const { initScene } = await import("./scene3d");
        if (disposed || reducedMotion || !heroVisible) {
          sceneLoadStarted = false;
          return;
        }

        const scene = await initScene(canvas);
        if (!scene) return;
        if (disposed || reducedMotion) {
          scene.dispose();
          return;
        }

        sceneRef.current = scene;
        root.dataset.sceneReady = "true";
        setSceneActive();
        scheduleScrollEffects();
      } catch (error) {
        sceneLoadStarted = false;
        console.warn("3D scene unavailable:", error);
      }
    };

    const scheduleSceneLoad = () => {
      if (disposed || reducedMotion || !heroVisible || sceneLoadStarted || cancelIdleSceneLoad) return;
      cancelIdleSceneLoad = scheduleIdle(() => void loadScene());
    };

    const disposeScene = () => {
      cancelIdleSceneLoad?.();
      cancelIdleSceneLoad = null;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      sceneLoadStarted = false;
      root.dataset.sceneReady = "false";
      root.dataset.sceneActive = "false";
      canvas.style.opacity = "0";
    };

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry?.isIntersecting ?? false;
        if (heroVisible) {
          scheduleSceneLoad();
        } else {
          cancelIdleSceneLoad?.();
          cancelIdleSceneLoad = null;
        }
        setSceneActive();
        scheduleScrollEffects();
      },
      { threshold: 0.01 }
    );
    heroObserver.observe(hero);

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
      reducedMotion = event.matches;
      if (reducedMotion) {
        revealElements.forEach((element) => {
          element.dataset.revealed = "true";
          element.dataset.inView = "true";
        });
        disposeScene();
      } else {
        scheduleSceneLoad();
      }
    };
    reducedMotionQuery.addEventListener("change", onReducedMotionChange);

    const onVisibilityChange = () => setSceneActive();
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onScroll = () => {
      pointerRectCache = new WeakMap<HTMLElement, DOMRect>();
      scheduleScrollEffects();
    };
    const onResize = () => {
      pointerRectCache = new WeakMap<HTMLElement, DOMRect>();
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

    scheduleScrollEffects();

    return () => {
      disposed = true;
      cancelIdleSceneLoad?.();
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      heroObserver.disconnect();
      sectionObserver.disconnect();
      revealObserver.disconnect();
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (pointerEffectsEnabled) {
        document.removeEventListener("pointermove", onPointerMove);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        document.documentElement.removeEventListener("pointerenter", onPointerEnter);
      }
      resetMagnetic(activeMagnetic);
      resetTilt(activeTilt);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [rootRef, heroRef, canvasRef, progressRef, ringRef, scrollHintRef, backTopRef]);
}
