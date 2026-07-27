"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SceneTier } from "@/lib/scene-quality";
import { useSceneQualityStore } from "@/stores/scene-quality-store";
import { readDeviceCapability } from "./scene-device";
import { resolveSceneTier, SCENE_PROFILES } from "./scene-quality";
import type { SceneApi, SceneStats } from "./scene-api";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const WIDE_VIEWPORT_QUERY = "(min-width: 1920px)";

interface OptionalIdleWindow {
  requestIdleCallback?: Window["requestIdleCallback"];
  cancelIdleCallback?: Window["cancelIdleCallback"];
}

export type SceneStatsListener = (stats: SceneStats | null) => void;

export interface LandingSceneRefs {
  rootRef: RefObject<HTMLDivElement | null>;
  heroRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export interface LandingScene {
  sceneRef: RefObject<SceneApi | null>;
  /** tier ที่กำลังใช้จริง (null = ยังไม่ตัดสินฝั่ง client) */
  tier: SceneTier | null;
  /**
   * key ของ <canvas> — ต้องเปลี่ยนทุกครั้งที่ต้องสร้างฉากใหม่ เพราะ antialias เป็น
   * context-creation parameter และ forceContextLoss() ทำให้ขอ context ใหม่บน canvas เดิมไม่ได้
   */
  canvasKey: string;
  subscribeStats: (listener: SceneStatsListener) => () => void;
}

function scheduleIdle(callback: () => void): () => void {
  const idleWindow = window as unknown as OptionalIdleWindow;
  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 800 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, 1);
  return () => window.clearTimeout(handle);
}

/** ถือครองวงจรชีวิตของฉาก 3D ทั้งหมด: เลือก tier, โหลดแบบ lazy, เปิด/ปิด, ทำลาย */
export function useLandingScene({ rootRef, heroRef, canvasRef }: LandingSceneRefs): LandingScene {
  const setting = useSceneQualityStore((state) => state.setting);
  const hydrated = useSceneQualityStore((state) => state.hydrated);
  const sceneRef = useRef<SceneApi | null>(null);
  const statsRef = useRef<SceneStats | null>(null);
  const listenersRef = useRef(new Set<SceneStatsListener>());
  const [tier, setTier] = useState<SceneTier | null>(null);

  const adaptive = setting === "auto";

  useEffect(() => {
    void useSceneQualityStore.persist.rehydrate();
  }, []);

  // tier ต้องคิดจาก navigator/matchMedia จึงคิดใน effect เท่านั้น ไม่งั้น SSR กับ client ไม่ตรงกัน
  useEffect(() => {
    if (!hydrated) return;

    const applyTier = () => setTier(resolveSceneTier(setting, readDeviceCapability()));
    applyTier();
    if (!adaptive) return;

    // Auto ใช้ความกว้าง viewport เป็นหนึ่งในสัญญาณ — ตรวจใหม่เมื่อข้ามเกณฑ์จอกว้าง
    const wideViewport = window.matchMedia(WIDE_VIEWPORT_QUERY);
    wideViewport.addEventListener("change", applyTier);
    return () => wideViewport.removeEventListener("change", applyTier);
  }, [adaptive, hydrated, setting]);

  const publishStats = useCallback((stats: SceneStats | null) => {
    statsRef.current = stats;
    listenersRef.current.forEach((listener) => listener(stats));
  }, []);

  const subscribeStats = useCallback((listener: SceneStatsListener) => {
    const listeners = listenersRef.current;
    listeners.add(listener);
    listener(statsRef.current);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const hero = heroRef.current;
    const canvas = canvasRef.current;
    if (!root || !hero || !canvas || !tier) return;

    let disposed = false;
    let reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    let heroVisible = false;
    let loadStarted = false;
    let cancelIdleLoad: (() => void) | null = null;

    const setSceneActive = () => {
      const active = Boolean(sceneRef.current && heroVisible && !document.hidden && !reducedMotion);
      sceneRef.current?.setActive(active);
      root.dataset.sceneActive = String(active);
      // ตอนหยุดฉากค้างค่าจางไว้เอง ตอนกลับมาปล่อยให้ CSS/สกรอลล์คุมต่อ
      canvas.style.opacity = active ? "" : root.dataset.sceneReady === "true" ? "0.18" : "0";
    };

    const loadScene = async () => {
      cancelIdleLoad = null;
      if (disposed || reducedMotion || !heroVisible || loadStarted || sceneRef.current) return;
      loadStarted = true;

      try {
        const { initScene } = await import("./scene3d");
        if (disposed || reducedMotion || !heroVisible) {
          loadStarted = false;
          return;
        }

        const scene = await initScene(canvas, {
          profile: SCENE_PROFILES[tier],
          adaptive,
          onStats: publishStats
        });
        if (!scene) return;
        if (disposed || reducedMotion) {
          scene.dispose();
          return;
        }

        sceneRef.current = scene;
        root.dataset.sceneReady = "true";
        setSceneActive();
      } catch (error) {
        loadStarted = false;
        console.warn("3D scene unavailable:", error);
      }
    };

    const scheduleSceneLoad = () => {
      if (disposed || reducedMotion || !heroVisible || loadStarted || cancelIdleLoad) return;
      cancelIdleLoad = scheduleIdle(() => void loadScene());
    };

    const disposeScene = () => {
      cancelIdleLoad?.();
      cancelIdleLoad = null;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      loadStarted = false;
      root.dataset.sceneReady = "false";
      root.dataset.sceneActive = "false";
      canvas.style.opacity = "0";
      publishStats(null);
    };

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry?.isIntersecting ?? false;
        if (heroVisible) {
          scheduleSceneLoad();
        } else {
          cancelIdleLoad?.();
          cancelIdleLoad = null;
        }
        setSceneActive();
      },
      { threshold: 0.01 }
    );
    heroObserver.observe(hero);

    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        disposeScene();
      } else {
        scheduleSceneLoad();
      }
    };
    reducedMotionQuery.addEventListener("change", onReducedMotionChange);

    const onVisibilityChange = () => setSceneActive();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      heroObserver.disconnect();
      disposeScene();
    };
  }, [adaptive, canvasRef, heroRef, publishStats, rootRef, tier]);

  return {
    sceneRef,
    tier,
    canvasKey: tier ? `${tier}-${adaptive ? "auto" : "fixed"}` : "idle",
    subscribeStats
  };
}
