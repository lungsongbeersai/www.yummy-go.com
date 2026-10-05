"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Pause, Play, UtensilsCrossed, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ALERT_SOUND_KINDS,
  ORDER_ALERT_SOUNDS,
  isOrderAlertSoundId,
  type AlertSoundKind,
  type OrderAlertSoundId
} from "@/lib/pos/order-alert-sounds";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

interface OrderAlertSoundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KIND_ICON = { order: UtensilsCrossed, waiter: BellRing } as const;

// เลือกเสียงแจ้งเตือนแยกตามเหตุการณ์ (ออเดอร์ใหม่ / เรียกพนักงาน) — เลือกแล้วบันทึกทันที (ไม่มีปุ่มบันทึก)
// และเล่นตัวอย่างให้ฟังเลย เพราะการเลือกเสียงโดยไม่ได้ยินก่อนแทบไม่มีประโยชน์ ตัวเล่นเสียง
// (hooks/use-alert-sound-player.ts) อ่านค่าจาก app-store แล้วสลับไฟล์ตามเอง
export function OrderAlertSoundDialog({ open, onOpenChange }: OrderAlertSoundDialogProps) {
  const { t } = useTranslation();
  const orderSound = useAppStore((state) => state.orderAlertSound);
  const waiterSound = useAppStore((state) => state.waiterAlertSound);
  const setOrderAlertSound = useAppStore((state) => state.setOrderAlertSound);
  const setWaiterAlertSound = useAppStore((state) => state.setWaiterAlertSound);
  const soundEnabled = useAppStore((state) => state.alertSoundEnabled);
  const setAlertSoundEnabled = useAppStore((state) => state.setAlertSoundEnabled);
  const [kind, setKind] = useState<AlertSoundKind>("order");
  const contentRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<OrderAlertSoundId | null>(null);

  function stopPreview() {
    previewRef.current?.pause();
    setPlayingId(null);
  }

  function playPreview(id: OrderAlertSoundId, src: string) {
    previewRef.current?.pause();
    const audio = new Audio(src);
    previewRef.current = audio;
    audio.onended = () => setPlayingId((current) => (current === id ? null : current));
    setPlayingId(id);
    void audio.play().catch(() => setPlayingId(null));
  }

  // ปิด dialog/unmount แล้วต้องหยุดตัวอย่างที่เล่นค้าง — ไฟล์บางตัว (เสียงโทรศัพท์) ยาวหลายวินาที
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) stopPreview();
    onOpenChange(nextOpen);
  }

  useEffect(() => () => previewRef.current?.pause(), []);

  // เปิดมา/สลับแท็บแล้วเลื่อนให้เห็นตัวที่เลือกอยู่ — ถ้าเลือกตัวท้าย ๆ (เช่น โทรศัพท์) จะไม่หลุดขอบล่าง
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.querySelector('[data-state="checked"]')?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, kind]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        ref={contentRef}
        className="sm:max-w-md"
        // โฟกัสอัตโนมัติของ Radix ไปตกที่แท็บแรกพร้อมกรอบโฟกัส ทั้งที่ผู้ใช้ยังไม่ได้กดอะไร —
        // โฟกัสที่ตัว dialog แทน (ยังอยู่ใน focus trap กด Tab ครั้งเดียวก็ถึงแท็บ)
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("notifications.sound.title")}</DialogTitle>
          <DialogDescription>{t("notifications.sound.description")}</DialogDescription>
        </DialogHeader>
        <Tabs
          value={kind}
          onValueChange={(value) => {
            if (value !== "order" && value !== "waiter") return;
            stopPreview();
            setKind(value);
          }}
          className="min-w-0 gap-3"
        >
          {/* สูง 44px ให้นิ้วกดง่ายบนแท็บเล็ต/มือถือ — h-8 เดิมของ TabsList ตั้งผ่าน variant
              group-data-horizontal จึงต้อง override ที่ variant เดียวกัน (h-11 ธรรมดาแพ้ specificity) */}
          <TabsList className="grid w-full grid-cols-2 group-data-horizontal/tabs:h-11">
            {ALERT_SOUND_KINDS.map((entry) => {
              const Icon = KIND_ICON[entry];
              return (
                <TabsTrigger key={entry} value={entry} className="gap-2 text-sm font-semibold">
                  <Icon aria-hidden />
                  {t(`notifications.sound.kinds.${entry}`)}
                  {/* เห็นจากแท็บเลยว่าแบบไหนปิดเสียงอยู่ ไม่ต้องสลับเข้าไปดู */}
                  {soundEnabled[entry] ? null : (
                    <VolumeX className="text-muted-foreground" aria-label={t("notifications.sound.off")} />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {ALERT_SOUND_KINDS.map((entry) => {
            const enabled = soundEnabled[entry];
            const switchId = `${entry}-alert-sound-enabled`;
            return (
              <TabsContent key={entry} value={entry} className="flex min-w-0 flex-col gap-3">
                {/* เปิด/ปิดเสียงของเหตุการณ์นี้ — ปิดแล้วยังมีป๊อปอัปบนจอ แค่ไม่ดัง; ทั้งแถวเป็น label ให้กดได้ทั้งแถบ */}
                <label
                  htmlFor={switchId}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                    {enabled ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{t("notifications.sound.enabled")}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {enabled ? t("notifications.sound.enabledOn") : t("notifications.sound.enabledOff")}
                    </span>
                  </span>
                  <Switch
                    id={switchId}
                    checked={enabled}
                    onCheckedChange={(checked) => {
                      if (!checked) stopPreview();
                      setAlertSoundEnabled(entry, checked);
                    }}
                  />
                </label>
                {/* แถวเรียบมีเส้นคั่นแทนการ์ดแยกทีละใบ — 9 ตัวเลือกเห็นครบในจอโดยไม่ต้องเลื่อน */}
                {/* ปิดเสียงแล้วจางรายการ + ปิดการเลือก — ยังเห็นว่าตั้งเสียงไหนไว้ เปิดกลับมาจะได้เสียงเดิม */}
                <div
                  ref={entry === kind ? listRef : undefined}
                  aria-disabled={!enabled}
                  className={cn(
                    "max-h-[min(48svh,28rem)] overflow-y-auto rounded-lg border transition-opacity",
                    !enabled && "pointer-events-none opacity-50"
                  )}
                >
                  <RadioGroup
                    aria-label={t(`notifications.sound.kinds.${entry}`)}
                    className="gap-0 divide-y"
                    value={entry === "waiter" ? waiterSound : orderSound}
                    disabled={!enabled}
                    onValueChange={(value) => {
                      if (!isOrderAlertSoundId(value)) return;
                      if (entry === "waiter") setWaiterAlertSound(value);
                      else setOrderAlertSound(value);
                      const sound = ORDER_ALERT_SOUNDS.find((item) => item.id === value);
                      if (sound) playPreview(sound.id, sound.src);
                    }}
                  >
                    {ORDER_ALERT_SOUNDS.map((sound) => {
                      const radioId = `${entry}-alert-sound-${sound.id}`;
                      const playing = playingId === sound.id;
                      return (
                        <label
                          key={sound.id}
                          htmlFor={radioId}
                          className="flex min-h-11 cursor-pointer items-center gap-3 py-1 pr-1 pl-3 transition-colors hover:bg-muted/60 has-data-[state=checked]:bg-primary/5"
                        >
                          <RadioGroupItem id={radioId} value={sound.id} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {t(`notifications.sound.options.${sound.id}`)}
                          </span>
                          <Button
                            aria-label={playing ? t("notifications.sound.stop") : t("notifications.sound.preview")}
                            size="icon"
                            type="button"
                            variant="ghost"
                            className="text-muted-foreground hover:text-foreground"
                            disabled={!enabled}
                            onClick={(event) => {
                              // ปุ่มอยู่ใน label — กันไม่ให้คลิกไปเลือก radio ด้วย (ฟังเฉย ๆ ยังไม่เปลี่ยนเสียง)
                              event.preventDefault();
                              if (playing) stopPreview();
                              else playPreview(sound.id, sound.src);
                            }}
                          >
                            {playing ? <Pause /> : <Play />}
                          </Button>
                        </label>
                    );
                  })}
                </RadioGroup>
              </div>
            </TabsContent>
            );
          })}
        </Tabs>
        <DialogFooter>
          <Button type="button" onClick={() => handleOpenChange(false)}>
            {t("actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
