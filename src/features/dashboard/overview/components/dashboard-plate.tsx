"use client";

import { memo, useEffect, useState } from "react";
import { HandCoins, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VisualEffectsTier } from "@/lib/visual-effects-tier";
import { buildGuillochePath } from "@/features/dashboard/overview/dashboard-engraving";
import {
  formatKip,
  formatPercent,
  kipFigureSize,
  splitMoneyString,
  type DashboardCopy,
  type SkylineColumn,
} from "@/features/dashboard/overview/dashboard-view-model";

// Computed once per session, not per render: ~1.8k points of closed curves.
const GUILLOCHE_PATH = buildGuillochePath();

const plateClassName =
  "relative isolate gap-0 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-dash-plate ring-0 sm:p-6 lg:min-h-80 xl:p-7 2xl:col-span-8";

// The sheen/shade overlay lives on its own layer: tailwind-merge reads `bg-dash-plate` as a
// background colour and would drop `bg-primary` if both went through cn() on the Card.
// The security engraving sits in the plate's top-right corner, which holds no small text: at
// the sheen's peak the contrast is only enough for the large numeral (see --dash-* in globals).
function PlateEngraving() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-dash-plate" />
      <PlateRosette />
    </>
  );
}

function PlateRosette() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 -right-24 size-64 overflow-hidden transform-gpu sm:size-80 lg:-top-32 lg:-right-28 lg:size-112"
    >
      <svg viewBox="-100 -100 200 200" className="size-full" focusable="false">
        <path
          d={GUILLOCHE_PATH}
          className="fill-none stroke-(--dash-engrave)"
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Odometer timings per tier; the static tier renders plain text instead.
const rollTiming = {
  full: { delayPerDigit: 45, duration: 700 },
  lite: { delayPerDigit: 0, duration: 500 },
} as const;

/**
 * Starts every digit at 0 and rolls to the value on the next frame; afterwards only digits
 * that actually change move. A value that did not change never animates.
 */
function useRolledFigure(figure: string, animate: boolean) {
  const [rolled, setRolled] = useState(() => (animate ? figure.replace(/\d/g, "0") : figure));

  useEffect(() => {
    if (!animate) return;
    const frame = requestAnimationFrame(() => setRolled(figure));
    return () => cancelAnimationFrame(frame);
  }, [animate, figure]);

  return animate ? rolled : figure;
}

function KipOdometer({ tier, value }: { tier: VisualEffectsTier; value: string }) {
  const parts = splitMoneyString(value);
  const animate = tier !== "static" && parts !== null;
  const rolled = useRolledFigure(parts?.number ?? value, animate);
  const long = kipFigureSize(parts?.number ?? value) === "long";
  const numeralClassName = cn(
    "font-heading font-extrabold font-stretch-condensed tabular-nums leading-none tracking-tight",
    long ? "text-4xl sm:text-5xl xl:text-6xl" : "text-5xl sm:text-6xl xl:text-7xl",
  );

  if (!parts || tier === "static") {
    return (
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className={numeralClassName}>{parts?.number ?? value}</span>
        {parts?.unit ? <PlateUnit unit={parts.unit} /> : null}
      </p>
    );
  }

  const timing = rollTiming[tier];
  const characters = Array.from(rolled);

  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
      {/* The visible unit below is read once; the digit strips are aria-hidden. */}
      <span className="sr-only">{parts.number}</span>
      <span aria-hidden="true" className={cn("inline-flex", numeralClassName)}>
        {characters.map((character, index) => {
          // Keyed by place value from the right, so a longer number adds columns on the left
          // and every existing column keeps rolling from where it was.
          const place = characters.length - index;
          if (!/\d/.test(character)) {
            return <span key={`sep-${place}`}>{character}</span>;
          }
          const digitsFromRight = characters.slice(index + 1).filter((next) => /\d/.test(next)).length;
          return (
            <span key={`digit-${place}`} className="relative inline-block h-[1em] overflow-hidden">
              <span
                className="flex flex-col transition-transform motion-reduce:transition-none"
                style={{
                  transform: `translate3d(0, -${Number(character) * 10}%, 0)`,
                  transitionDelay: `${digitsFromRight * timing.delayPerDigit}ms`,
                  transitionDuration: `${timing.duration}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {DIGITS.map((digit) => (
                  <span key={digit} className="h-[1em]">
                    {digit}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
      {parts.unit ? <PlateUnit unit={parts.unit} /> : null}
    </p>
  );
}

function PlateUnit({ unit }: { unit: string }) {
  return <span className="font-heading text-xl font-semibold sm:text-2xl xl:text-3xl">{unit}</span>;
}

// One column per day: paid part solid, owed part hatched, the peak day marked with a dot. The
// footer's two swatches are its legend, and the same numbers are written out in the sales card.
function PlateSkyline({ columns, tier }: { columns: SkylineColumn[]; tier: VisualEffectsTier }) {
  return (
    <div aria-hidden="true" className="h-16 overflow-hidden lg:h-44 lg:self-end">
      <div
        className={cn(
          "flex h-full items-end gap-px sm:gap-0.5",
          tier === "full" && "motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:fill-mode-both motion-safe:delay-150 motion-safe:duration-700",
          tier === "lite" && "motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:fill-mode-both motion-safe:duration-500",
        )}
      >
        {columns.map((column) => (
          <div key={column.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            {column.isPeak ? <span className="mb-1 size-1.5 shrink-0 rounded-full bg-primary-foreground" /> : null}
            <div
              className="flex w-full flex-col overflow-hidden rounded-t-xs"
              // Scaled to 90% so the peak dot always has room above the tallest column.
              style={{ height: `${column.height * 0.9}%` }}
            >
              <div className="bg-hatch text-primary-foreground" style={{ flexBasis: 0, flexGrow: column.owedPercent }} />
              <div className="bg-primary-foreground/75" style={{ flexBasis: 0, flexGrow: 100 - column.owedPercent }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const RevenuePlate = memo(function RevenuePlate({
  balance,
  collectionRate,
  copy,
  label,
  paid,
  period,
  skyline,
  tier,
  unpaidRate,
  value,
}: {
  balance: number;
  collectionRate: number;
  copy: DashboardCopy;
  label: string;
  paid: number;
  period: string;
  skyline: SkylineColumn[];
  /** Entrance classes play once, when the plate mounts with the first data; refetches keep them. */
  tier: VisualEffectsTier;
  unpaidRate: number;
  value: string;
}) {
  const rate = Math.min(100, Math.max(0, collectionRate));
  const hasSkyline = skyline.length >= 2;

  return (
    <Card
      data-dashboard-revenue-card="true"
      className={cn(
        plateClassName,
        tier === "full" && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-500",
        tier === "lite" && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:fill-mode-both motion-safe:duration-300",
      )}
    >
      <PlateEngraving />
      <div className={cn("relative z-10 grid flex-1 gap-5", hasSkyline && "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]")}>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-col items-start gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-(--dash-shade)">
                <TrendingUp className="size-4" />
              </span>
              {label}
            </span>
            {period ? (
              <Badge className="h-auto border-transparent bg-(--dash-shade) py-0.5 text-2xs text-primary-foreground tabular-nums">
                {period}
              </Badge>
            ) : null}
          </div>
          {/* Eyebrow on top, figure and meter on the plate's baseline whatever the row height. */}
          <div className="mt-auto flex flex-col">
            <KipOdometer tier={tier} value={value} />
            <div className="mt-5 flex flex-col gap-2 lg:max-w-md">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{copy.collectionRate}</span>
                <span className="text-sm font-bold tabular-nums">{formatPercent(rate)}</span>
              </div>
              <div className="relative">
                <Progress
                  aria-label={copy.collectionRate}
                  value={rate}
                  className={cn(
                    "h-2.5 rounded-full bg-(--dash-shade) *:data-[slot=progress-indicator]:bg-primary-foreground",
                    tier === "full" && "*:data-[slot=progress-indicator]:duration-1000",
                  )}
                />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-dash-notches" />
              </div>
            </div>
          </div>
        </div>
        {hasSkyline ? <PlateSkyline columns={skyline} tier={tier} /> : null}
      </div>
      <div className="relative z-10 mt-5 grid grid-cols-2 gap-4 border-t border-(--dash-shade) pt-4">
        <PlateFigure
          icon={<HandCoins aria-hidden="true" className="size-3.5" />}
          label={copy.paidTotal}
          swatch={<span aria-hidden="true" className="size-2.5 shrink-0 rounded-xs bg-primary-foreground/75" />}
          value={formatKip(paid)}
        />
        <PlateFigure
          icon={<Wallet aria-hidden="true" className="size-3.5" />}
          label={`${copy.balance} · ${formatPercent(unpaidRate)}`}
          swatch={<span aria-hidden="true" className="size-2.5 shrink-0 rounded-xs bg-hatch text-primary-foreground" />}
          value={formatKip(balance)}
        />
      </div>
    </Card>
  );
});

function PlateFigure({
  icon,
  label,
  swatch,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  swatch: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-semibold">
        {swatch}
        {icon}
        <span className="min-w-0">{label}</span>
      </span>
      <span className="font-heading text-base font-bold font-stretch-semi-condensed tabular-nums sm:text-lg">{value}</span>
    </div>
  );
}

// The loading plate keeps the real surface so the first paint already reads as the hero.
export function RevenuePlateSkeleton() {
  return (
    <Card aria-hidden="true" className={plateClassName}>
      <PlateEngraving />
      <div className="relative z-10 flex flex-col gap-4">
        <Skeleton data-skeleton-tone="inverse" className="h-5 w-32" />
        <Skeleton data-skeleton-tone="inverse" className="h-12 w-3/4 sm:h-14 xl:h-16" />
        <Skeleton data-skeleton-tone="inverse" className="h-2.5 w-full lg:max-w-md" />
      </div>
      <div className="relative z-10 mt-5 grid grid-cols-2 gap-4 border-t border-(--dash-shade) pt-4">
        <Skeleton data-skeleton-tone="inverse" className="h-10 w-full" />
        <Skeleton data-skeleton-tone="inverse" className="h-10 w-full" />
      </div>
    </Card>
  );
}
