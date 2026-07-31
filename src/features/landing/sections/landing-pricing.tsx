"use client";

import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/format";
import type { Language } from "@/lib/language";
import type { PackageBillingGroup, PackageItem } from "@/services/package";
import { usePublicPackageStore } from "@/stores/public-package-store";
import { landingUi, pickText } from "../landing-data";
import styles from "../landing.module.css";

interface LandingPricingProps {
  language: Language;
}

interface PricingCard {
  id: string;
  method: string;
  name: string;
  price: number;
  features: string[];
  savings: number | null;
}

const ACTIVE = 1;

export function LandingPricing({ language }: LandingPricingProps) {
  const groups = usePublicPackageStore((state) => state.groups);
  const loaded = usePublicPackageStore((state) => state.loaded);
  const load = usePublicPackageStore((state) => state.load);
  const [selectedCycleId, setSelectedCycleId] = useState("");

  useEffect(() => {
    void load(language);
  }, [language, load]);

  // API ส่ง package_status=1 มาแล้ว แต่ยังกรองซ้ำที่ชั้นแสดงผล เพราะสถานะซ้อนกัน 3 ชั้น
  // (รอบบิล → วิธี/แผน → แพ็กเกจ) และตัวกรองฝั่ง API ครอบไม่ถึงทุกชั้น
  const cycles = useMemo(() => groups.filter(isActiveCycle), [groups]);
  const activeCycle = cycles.find((cycle) => cycle.id === selectedCycleId) ?? cycles[0] ?? null;

  // ราคาต่อเดือนของแต่ละวิธี ใช้เป็นฐานคำนวณ "ประหยัดกี่ %" ของรอบบิลที่ยาวกว่า
  const monthlyPriceByMethod = useMemo(() => {
    const map = new Map<string, number>();
    const monthly = cycles.find((cycle) => cycle.months === 1);
    if (!monthly) return map;

    for (const method of monthly.methods) {
      const cheapest = activePackages(method.packages)[0];
      if (cheapest) map.set(method.methodId, cheapest.price);
    }
    return map;
  }, [cycles]);

  const cards = useMemo<PricingCard[]>(() => {
    if (!activeCycle) return [];

    return activeCycle.methods
      .filter((method) => method.methodStatus === ACTIVE && method.planStatus === ACTIVE)
      .flatMap((method) =>
        activePackages(method.packages).map((item) => ({
          id: item.id,
          method: method.methodName,
          name: item.name,
          price: item.price,
          features: item.details.filter((detail) => detail.status === ACTIVE).map((detail) => detail.name),
          savings: savingsPercent(monthlyPriceByMethod.get(method.methodId), item.price, activeCycle.months)
        }))
      );
  }, [activeCycle, monthlyPriceByMethod]);

  // ยังไม่โหลดเสร็จ = ไม่ต้องจองพื้นที่ / โหลดไม่ได้หรือไม่มีแพ็กเกจ = ซ่อนเซกชันไปเลย
  // หน้าแรกเป็นหน้าการตลาด ไม่ควรโชว์กล่อง error ให้ผู้เยี่ยมชมเห็น
  if (!loaded || !cards.length) return null;

  return (
    <section id="pricing" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInner}>
        <div data-reveal className={`${styles.reveal} ${styles.sectionHead}`}>
          <div className={styles.kicker}>{pickText(landingUi.pricingKicker, language)}</div>
          <h2 className={styles.sectionTitle}>{pickText(landingUi.pricingTitle, language)}</h2>
          <p className={styles.pricingSubtitle}>{pickText(landingUi.pricingSubtitle, language)}</p>
        </div>

        {cycles.length > 1 ? (
          <div data-reveal className={`${styles.reveal} ${styles.pricingCycles}`} role="tablist">
            {cycles.map((cycle) => {
              const active = cycle.id === activeCycle?.id;
              return (
                <button
                  key={cycle.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`${styles.pricingCycleBtn} ${active ? styles.pricingCycleBtnActive : ""}`}
                  onClick={() => setSelectedCycleId(cycle.id)}
                >
                  {cycle.billingCycleName}
                </button>
              );
            })}
          </div>
        ) : null}

        <div data-reveal className={`${styles.reveal} ${styles.pricingGrid}`}>
          {cards.map((card) => (
            <div key={card.id} data-tilt className={styles.pricingCard}>
              <div className={styles.cardTopLine} />
              <div data-glare className={styles.glare} />

              <div className={styles.pricingMethod}>{card.method}</div>
              <div className={styles.pricingName}>{card.name}</div>

              <div className={styles.pricingPriceRow}>
                <span className={styles.pricingPrice}>{money(card.price)}</span>
                {activeCycle ? <span className={styles.pricingCycleUnit}>/ {activeCycle.billingCycleName}</span> : null}
              </div>

              {card.savings ? (
                <div className={styles.pricingSavings}>
                  {pickText(landingUi.pricingSavings, language).replace("{value}", String(card.savings))}
                </div>
              ) : null}

              {card.features.length ? (
                <ul className={styles.pricingFeatures}>
                  {card.features.map((feature) => (
                    <li key={feature} className={styles.pricingFeature}>
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : null}

              <a className={styles.pricingCta} href="#contact">
                {pickText(landingUi.pricingCta, language)}
              </a>
            </div>
          ))}
        </div>

        <div data-reveal className={`${styles.reveal} ${styles.pricingHelp}`}>
          <span>{pickText(landingUi.pricingHelp, language)}</span>
          <a className={styles.btnSmallLink} href="#contact">
            {pickText(landingUi.pricingHelpCta, language)}
          </a>
        </div>
      </div>
    </section>
  );
}

function isActiveCycle(cycle: PackageBillingGroup) {
  return cycle.status === ACTIVE && cycle.methods.length > 0;
}

function activePackages(packages: PackageItem[]) {
    return packages.filter((item) => item.status === ACTIVE);
}

// ใช้สูตรเดียวกับหน้าจัดการแพ็กเกจ: เทียบราคารอบยาวกับราคารายเดือน × จำนวนเดือน
function savingsPercent(monthlyPrice: number | undefined, cyclePrice: number, months: number) {
  if (!monthlyPrice || monthlyPrice <= 0 || cyclePrice <= 0 || months <= 1) return null;

  const monthlyTotal = monthlyPrice * months;
  const savings = Math.round(((monthlyTotal - cyclePrice) / monthlyTotal) * 100);
  return savings > 0 ? savings : null;
}
