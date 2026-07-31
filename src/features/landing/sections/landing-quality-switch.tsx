"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Language } from "@/lib/language";
import { SCENE_QUALITY_SETTINGS, type SceneQualitySetting, type SceneTier } from "@/lib/scene-quality";
import { useSceneQualityStore } from "@/stores/scene-quality-store";
import { pickText, type LocalizedText } from "../landing-data";
import { landingUi } from "../landing-ui";
import type { SceneStats } from "../scene-api";
import type { SceneStatsListener } from "../use-landing-scene";
import styles from "../landing.module.css";

interface LandingQualitySwitchProps {
  language: Language;
  /** tier ที่ใช้จริง — โหมด Auto จะเอามาโชว์ว่าเครื่องนี้ถูกจัดไปอยู่ระดับไหน */
  tier: SceneTier | null;
  subscribeStats: (listener: SceneStatsListener) => () => void;
}

const OPTION_TEXT: Record<SceneQualitySetting, { label: LocalizedText; hint: LocalizedText }> = {
  auto: { label: landingUi.qualityAuto, hint: landingUi.qualityAutoHint },
  low: { label: landingUi.qualityLow, hint: landingUi.qualityLowHint },
  medium: { label: landingUi.qualityMedium, hint: landingUi.qualityMediumHint },
  high: { label: landingUi.qualityHigh, hint: landingUi.qualityHighHint },
  ultra: { label: landingUi.qualityUltra, hint: landingUi.qualityUltraHint }
};

const TIER_LABEL: Record<SceneTier, LocalizedText> = {
  low: landingUi.qualityLow,
  medium: landingUi.qualityMedium,
  high: landingUi.qualityHigh,
  ultra: landingUi.qualityUltra
};

export function LandingQualitySwitch({ language, tier, subscribeStats }: LandingQualitySwitchProps) {
  const setting = useSceneQualityStore((state) => state.setting);
  const setSetting = useSceneQualityStore((state) => state.setSetting);
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<SceneStats | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const text = (value: LocalizedText) => pickText(value, language);

  // เกาะสถิติเฉพาะตอนเปิด panel เพื่อไม่ให้หน้า landing รีเรนเดอร์ทุกวินาทีตลอดเวลา
  useEffect(() => {
    if (!open) return;
    return subscribeStats(setStats);
  }, [open, subscribeStats]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    // ย้ายโฟกัสเข้า panel ให้คีย์บอร์ดเลื่อนลูกศรเลือก tier ได้ทันที
    panelRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const activeTierLabel = tier ? text(TIER_LABEL[tier]) : "—";
  const statusText =
    stats && stats.fps > 0
      ? `${stats.fps} ${text(landingUi.qualityFps)} · ${stats.dpr.toFixed(2)}×`
      : text(landingUi.qualityOff);

  return (
    <div ref={containerRef} className={styles.qualitySwitch} data-no-pulse>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={text(landingUi.qualityTitle)}
        title={text(landingUi.qualityTitle)}
        className={styles.qualityTrigger}
        data-open={open}
      >
        <span aria-hidden="true">◆</span>
      </button>

      {open ? (
        <div id={panelId} ref={panelRef} className={styles.qualityPanel}>
          {/* fieldset + legend ให้ความหมาย group และ radio จริงให้ keyboard nav ฟรี ไม่ต้องเขียน roving tabindex */}
          <fieldset className={styles.qualityFieldset}>
            <legend className={styles.qualityLegend}>{text(landingUi.qualityTitle)}</legend>

            {SCENE_QUALITY_SETTINGS.map((option) => (
              <label
                key={option}
                className={styles.qualityOption}
                data-active={setting === option}
              >
                <input
                  type="radio"
                  name="landing-scene-quality"
                  value={option}
                  checked={setting === option}
                  onChange={() => setSetting(option)}
                  className={styles.qualityRadio}
                />
                <span className={styles.qualityOptionLabel}>
                  {text(OPTION_TEXT[option].label)}
                  {option === "auto" && tier ? (
                    <span className={styles.qualityOptionTier}>{activeTierLabel}</span>
                  ) : null}
                </span>
                <span className={styles.qualityOptionHint}>{text(OPTION_TEXT[option].hint)}</span>
              </label>
            ))}
          </fieldset>

          <p className={styles.qualityStats} aria-live="polite">
            <span className={styles.qualityStatsValue}>{statusText}</span>
            <span className={styles.qualityStatsHint}>
              {stats?.adaptive && stats.renderScale < 1
                ? `${text(landingUi.qualityAdaptive)} ${Math.round(stats.renderScale * 100)}%`
                : text(landingUi.qualityStatsHint)}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
