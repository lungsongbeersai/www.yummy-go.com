"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ORDER_ALERT_SOUNDS, isOrderAlertSoundId, type OrderAlertSoundId } from "@/lib/pos/order-alert-sounds";
import { useAppStore } from "@/stores/app-store";

interface OrderAlertSoundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// เลือกเสียงแจ้งเตือนออเดอร์ใหม่ — เลือกแล้วบันทึกทันที (ไม่มีปุ่มบันทึก) และเล่นตัวอย่าง
// ให้ฟังเลย เพราะการเลือกเสียงโดยไม่ได้ยินก่อนแทบไม่มีประโยชน์ ตัว listener
// (use-pos-order-alert-listener.ts) อ่านค่าจาก app-store แล้วสลับไฟล์ตามเอง
export function OrderAlertSoundDialog({ open, onOpenChange }: OrderAlertSoundDialogProps) {
  const { t } = useTranslation();
  const selected = useAppStore((state) => state.orderAlertSound);
  const setOrderAlertSound = useAppStore((state) => state.setOrderAlertSound);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("notifications.sound.title")}</DialogTitle>
          <DialogDescription>{t("notifications.sound.description")}</DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label={t("notifications.sound.title")}
          className="max-h-[60svh] gap-2 overflow-y-auto"
          value={selected}
          onValueChange={(value) => {
            if (!isOrderAlertSoundId(value)) return;
            setOrderAlertSound(value);
            const sound = ORDER_ALERT_SOUNDS.find((entry) => entry.id === value);
            if (sound) playPreview(sound.id, sound.src);
          }}
        >
          {ORDER_ALERT_SOUNDS.map((sound) => {
            const radioId = `order-alert-sound-${sound.id}`;
            const playing = playingId === sound.id;
            return (
              <FieldLabel key={sound.id} htmlFor={radioId}>
                <Field orientation="horizontal" className="items-center">
                  <RadioGroupItem id={radioId} value={sound.id} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {t(`notifications.sound.options.${sound.id}`)}
                  </span>
                  <Button
                    aria-label={playing ? t("notifications.sound.stop") : t("notifications.sound.preview")}
                    size="icon"
                    type="button"
                    variant="ghost"
                    onClick={(event) => {
                      // ปุ่มอยู่ใน label — กันไม่ให้คลิกไปเลือก radio ด้วย (ฟังเฉย ๆ ยังไม่เปลี่ยนเสียง)
                      event.preventDefault();
                      if (playing) stopPreview();
                      else playPreview(sound.id, sound.src);
                    }}
                  >
                    {playing ? <Pause /> : <Play />}
                  </Button>
                </Field>
              </FieldLabel>
            );
          })}
        </RadioGroup>
        <DialogFooter>
          <Button type="button" onClick={() => handleOpenChange(false)}>
            {t("actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
