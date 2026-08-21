"use client";

import { useTranslation } from "react-i18next";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroBurger } from "./public-hero-burger";

/** Hero ของเมนูสาธารณะ
 *
 *  ส่วนตกแต่งมีสองชั้นซ้อนกัน — ชั้นล่างเป็นงานประกอบ CSS ล้วน (วงโคจร + แสงนวล
 *  + ตะแกรง) ซึ่งแสดงทันทีโดยไม่มีต้นทุนดาวน์โหลด ชั้นบนเป็นเบอร์เกอร์ 3D
 *  ที่ค่อยจางเข้ามาทับเมื่อโหลดเสร็จ
 *
 *  ทำเป็นสองชั้นเพราะโมเดลถูก gate ไว้หลายด่าน (reduced-motion, สเปกเครื่อง,
 *  โหมดประหยัดเน็ต, WebGL, ต้องเลื่อนเข้าจอก่อน) เครื่องที่ไม่ผ่านจะไม่โหลด
 *  อะไรเลยและยังได้ hero ที่ดูสมบูรณ์อยู่ ไม่ต้องมี state สลับหรือ fallback แยก
 */
export function PublicMenuHero({ onSearch }: { onSearch: () => void }) {
  const { t } = useTranslation();
  const searchLabel = t("pos.searchMenu");

  return (
    <section className="yg-rise relative flex min-h-[clamp(310px,42vw,420px)] overflow-hidden rounded-[28px] border border-yg-line shadow-[0_30px_70px_-30px_rgb(0_0_0/0.55)] dark:shadow-[0_30px_70px_-30px_rgb(0_0_0/0.8)]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "var(--yg-hero)" }}
      />
      <HeroOrnament />
      {/* กรอบเดียวกับวงโคจรของ ornament เพื่อให้เบอร์เกอร์มาแทนที่ตรงตำแหน่งพอดี */}
      <HeroBurger className="z-1 right-[8%] top-1/2 h-[min(78vw,360px)] w-[min(78vw,360px)] -translate-y-1/2" />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-2"
        style={{ background: "var(--yg-hero-scrim)" }}
      />

      <div className="relative z-3 flex max-w-[min(94%,560px)] flex-1 flex-col justify-center gap-4 p-[clamp(22px,4vw,44px)]">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-yg-accent-line bg-yg-accent-soft px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-yg-accent-strong">
          <Sparkles className="size-3" aria-hidden="true" />
          {t("pos.menuHeroBadge")}
        </span>

        <h1 className="lao-tone-text font-yg-serif text-[clamp(30px,6.6vw,52px)] font-semibold leading-[1.12] tracking-tight text-balance text-yg-ink">
          {t("pos.menuHeroTitleLead")}
          <br />
          <span className="text-yg-accent-strong">
            {t("pos.menuHeroTitleAccent")}
          </span>
        </h1>

        <p className="max-w-[38ch] text-[clamp(13px,2.4vw,15px)] font-medium leading-relaxed text-yg-muted">
          {t("pos.menuHeroSubtitle")}
        </p>

        <div className="mt-1 flex max-w-110 gap-2.5">
          {/* อ่านอย่างเดียว กดแล้วเปิด search sheet เดิม — พฤติกรรมเดียวกับแถบค้นหาที่มีอยู่ */}
          <Button
            type="button"
            variant="outline"
            onClick={onSearch}
            aria-haspopup="dialog"
            className="relative h-12.5 min-w-0 flex-1 justify-start rounded-[15px] border-yg-line bg-yg-bg/50 pl-10 pr-4 text-sm font-medium text-yg-faint backdrop-blur-sm hover:border-yg-accent-line hover:bg-yg-bg/50 hover:text-yg-muted focus-visible:ring-yg-accent focus-visible:ring-offset-yg-bg motion-reduce:transition-none"
          >
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            {searchLabel}
          </Button>

          <Button
            type="button"
            onClick={onSearch}
            aria-label={searchLabel}
            className="h-12.5 flex-none rounded-[15px] bg-yg-accent px-5.5 text-sm font-extrabold text-yg-on-accent shadow-[0_8px_22px_-8px_var(--yg-accent)] hover:bg-yg-accent hover:brightness-105 focus-visible:ring-yg-accent focus-visible:ring-offset-yg-bg motion-reduce:transition-none"
          >
            {t("pos.searchSubmit")}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** งานตกแต่งฝั่งขวาของ hero — วางตำแหน่งตรงกับที่ดีไซน์วาง 3D mesh ไว้
 *
 *  โครงเป็น wrapper (คุมตำแหน่ง/การเอียง) + ลูกที่กินเต็ม wrapper (คุม animation)
 *  แยกกันเพราะ keyframe ที่นี่เขียนทับ transform ทั้งก้อน ถ้าใส่ไว้ element เดียว
 *  กับ utility อย่าง -translate-y-1/2 หรือ rotateX จะตีกันแล้วท่าเอียงหาย
 */
function HeroOrnament() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-1 overflow-hidden"
    >
      {/* แสงนวลเป็นแกนกลางของงานประกอบ */}
      <div className="absolute right-[8%] top-1/2 h-[min(74vw,340px)] w-[min(74vw,340px)] -translate-y-1/2">
        <div
          className="yg-drift absolute inset-0 rounded-full opacity-35 blur-xl"
          style={{
            background:
              "radial-gradient(circle at 38% 34%, var(--yg-accent-strong), var(--yg-accent) 32%, transparent 68%)",
          }}
        />
      </div>

      {/* วงโคจรซ้อนชั้น แทนโครง wireframe ของดีไซน์เดิม */}
      <div className="absolute right-[8%] top-1/2 h-[min(70vw,320px)] w-[min(70vw,320px)] -translate-y-1/2">
        <div className="absolute inset-0 [transform:rotateX(62deg)]">
          <div className="yg-orbit absolute inset-0 rounded-full border border-yg-accent-line" />
        </div>

        <div className="absolute inset-[12%] opacity-70 [transform:rotateX(58deg)_rotateZ(38deg)]">
          <div className="yg-orbit-reverse absolute inset-0 rounded-full border border-yg-accent-line" />
        </div>

        <div className="absolute inset-[26%] rounded-full border border-yg-line" />

        {/* วงแหวนไล่สีให้ติดประกายแบบ specular ของวัสดุเดิม */}
        <div className="absolute inset-[30%]">
          <div
            className="yg-orbit absolute inset-0 rounded-full opacity-55"
            style={{
              background:
                "conic-gradient(from 210deg, transparent 0deg, var(--yg-accent-strong) 70deg, transparent 150deg, var(--yg-accent) 250deg, transparent 330deg)",
              maskImage:
                "radial-gradient(circle, transparent 58%, black 60%)",
              WebkitMaskImage:
                "radial-gradient(circle, transparent 58%, black 60%)",
            }}
          />
        </div>
      </div>

      {/* ตะแกรงละเอียด ให้พื้นไม่เรียบจนแบน */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(var(--yg-line2) 1px, transparent 1px), linear-gradient(90deg, var(--yg-line2) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(120% 90% at 82% 50%, black 0%, transparent 62%)",
          WebkitMaskImage:
            "radial-gradient(120% 90% at 82% 50%, black 0%, transparent 62%)",
        }}
      />
    </div>
  );
}
