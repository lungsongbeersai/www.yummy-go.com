"use client";

import { useCallback, useEffect, useRef } from "react";
import { orderAlertSoundSrc, type AlertSoundKind } from "@/lib/pos/order-alert-sounds";
import { useAppStore } from "@/stores/app-store";

const audioUnlockEvents = ["click", "touchstart", "keydown"] as const;

// เสียงแจ้งเตือนฝั่งพนักงาน — แต่ละเหตุการณ์ (ออเดอร์ใหม่ / ลูกค้าเรียกพนักงาน) ใช้เสียงที่เลือกแยกไว้ในเมนูแจ้งเตือน
export function useAlertSoundPlayer(kind: AlertSoundKind) {
  const soundSrc = orderAlertSoundSrc(
    useAppStore((state) => (kind === "waiter" ? state.waiterAlertSound : state.orderAlertSound))
  );
  const soundSrcRef = useRef(soundSrc);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio(soundSrcRef.current);
    audio.preload = "auto";
    audioRef.current = audio;
    return audio;
  }, []);

  const unlockAudio = useCallback(() => {
    const audio = ensureAudio();
    if (unlockedRef.current) return;

    // ต้องเรียก play() ใน user gesture จริงเพื่อปลดล็อก autoplay policy แต่ต้องปิดเสียงก่อน —
    // กว่า play() จะ resolve แล้วค่อย pause ใช้เวลาเกินครึ่งวินาที ถ้าไม่ปิดเสียงผู้ใช้จะได้ยิน
    // เสียงแจ้งเตือนออเดอร์เต็ม ๆ ทุกครั้งที่คลิกแรกของหน้า (เช่นกดเปลี่ยนหน้า pagination)
    audio.muted = true;
    audio.volume = 0;

    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        unlockedRef.current = true;
      })
      .catch(() => {})
      .finally(() => {
        audio.muted = false;
        audio.volume = 1;
      });
  }, [ensureAudio]);

  // เปลี่ยนเสียงที่เลือกในเมนูแจ้งเตือน — สลับ src บน element เดิมแทนการสร้าง Audio ใหม่
  // เพื่อไม่ให้ต้องปลดล็อก autoplay ซ้ำ (ปลดล็อกผูกกับเอกสาร ไม่ใช่ไฟล์เสียง)
  useEffect(() => {
    soundSrcRef.current = soundSrc;
    const audio = audioRef.current;
    if (!audio || audio.src.endsWith(soundSrc)) return;
    audio.pause();
    audio.src = soundSrc;
    audio.load();
  }, [soundSrc]);

  useEffect(() => {
    ensureAudio();
    audioUnlockEvents.forEach((eventName) => {
      document.addEventListener(eventName, unlockAudio, { capture: true, once: true });
    });

    return () => {
      audioUnlockEvents.forEach((eventName) => {
        document.removeEventListener(eventName, unlockAudio, { capture: true });
      });
      audioRef.current?.pause();
      audioRef.current = null;
      unlockedRef.current = false;
    };
  }, [ensureAudio, unlockAudio]);

  return useCallback(() => {
    // อ่านตอนเล่นจริง (ไม่ผูกเป็น dependency) — สลับเปิด/ปิดแล้วมีผลทันทีโดยไม่ต้องสร้าง callback ใหม่
    if (!useAppStore.getState().alertSoundEnabled[kind]) return;
    const audio = ensureAudio();
    // เผื่อแจ้งเตือนเข้ามาระหว่างที่ unlock ยังปิดเสียงค้างอยู่ — จะได้ไม่เตือนแบบเงียบสนิท
    audio.muted = false;
    audio.volume = 1;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, [ensureAudio, kind]);
}
