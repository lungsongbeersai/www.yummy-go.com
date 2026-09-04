"use client";

import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

// เมนู view_only (ສ້າງ QR ເມນູອາຫານ) — แบนเนอร์เด่นบนสุด ชวนลูกค้าสแกน QR
// โต๊ะจากพนักงานเพื่อสลับไปโหมดสั่งอาหารได้จริง
export function PublicViewOnlyOrderBanner({
  onScan,
  triggerRef,
}: {
  onScan: () => void;
  // ให้ modal รายละเอียดสินค้า (ดูอย่างเดียว) ปิดตัวเองแล้วโฟกัสกลับมาที่ปุ่มนี้ได้
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation();

  return (
    <section className="yg-rise flex flex-col items-start gap-3 rounded-[22px] border border-yg-accent-line bg-yg-accent-soft p-[clamp(16px,3vw,22px)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-2xl bg-yg-accent text-yg-on-accent"
        >
          <ScanLine className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-yg-serif text-base font-semibold text-yg-ink">
            {t("pos.viewOnlyOrderBannerTitle")}
          </p>
          <p className="text-sm text-yg-muted">
            {t("pos.viewOnlyOrderBannerSubtitle")}
          </p>
        </div>
      </div>

      <Button
        ref={triggerRef}
        type="button"
        onClick={onScan}
        className="h-11 w-full shrink-0 rounded-xl bg-yg-accent px-5 font-extrabold text-yg-on-accent hover:bg-yg-accent hover:brightness-105 sm:w-auto"
      >
        <ScanLine data-icon="inline-start" />
        {t("pos.viewOnlyOrderBannerCta")}
      </Button>
    </section>
  );
}
