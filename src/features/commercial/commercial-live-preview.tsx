"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { renderCommercialDocument } from "@/features/commercial/commercial-print";
import { updateCommercialPreview } from "@/features/commercial/commercial-page-layout";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import type { CommercialDocument } from "@/services/commercial";
import { useAppStore } from "@/stores/app-store";

interface CommercialLivePreviewProps { document: CommercialDocument; statusLabel?: string }

const A4_WIDTH = 794;
const A4_MIN_HEIGHT = 1123;

export function CommercialLivePreview({ document, statusLabel }: CommercialLivePreviewProps) {
  const l = useCommercialLabels();
  const { t } = useTranslation();
  const laoFont = useAppStore((state) => state.laoFont);
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ scale: 1, height: A4_MIN_HEIGHT });
  const [initialHtml] = useState(() => renderCommercialDocument(document, { laoFont }));

  useEffect(() => {
    const target = frame.current?.contentDocument;
    if (!ready || !target || !viewport.current) return;
    let active = true;
    let paint = 0;
    const measure = () => {
      if (!active) return;
      const width = viewport.current?.clientWidth ?? 0;
      if (!width) return;
      const pages = target.querySelector<HTMLElement>("[data-commercial-pages]");
      const height = Math.max(A4_MIN_HEIGHT, Math.ceil(pages?.getBoundingClientRect().height ?? A4_MIN_HEIGHT));
      const scale = Math.min(1, width / A4_WIDTH);
      setSize(previous => previous.height === height && previous.scale === scale ? previous : { scale, height });
    };
    const schedule = () => { if (active) { cancelAnimationFrame(paint); paint = requestAnimationFrame(measure); } };
    const style = target.createElement("style");
    style.id = "commercial-live-layout";
    style.textContent = "html{overflow:hidden}body{width:210mm;padding:0!important;overflow:hidden}";
    target.head.append(style);
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport.current);
    schedule();
    return () => { active = false; cancelAnimationFrame(paint); observer.disconnect(); style.remove(); };
  }, [ready]);

  useEffect(() => {
    const target = frame.current?.contentDocument;
    const paper = target?.querySelector<HTMLElement>("[data-commercial-source]");
    if (!ready || !target || !paper) return;
    let active = true;
    const current = () => active && frame.current?.contentDocument === target;
    const rendered = new DOMParser().parseFromString(renderCommercialDocument(document, { laoFont }), "text/html");
    const nextPaper = rendered.querySelector(".paper");
    if (!nextPaper) return;
    // Keep the canonical source and iframe intact while replacing only the
    // prepared A4 pages, so edits retain focus and old filler rows never grow.
    paper.innerHTML = nextPaper.innerHTML;
    const title = target.querySelector("title");
    if (title) title.textContent = rendered.title;
    target.documentElement.setAttribute("data-lao-font", laoFont);
    void updateCommercialPreview(target, current).then(result => {
      if (!result || !current()) return;
      setError(null);
      const width = viewport.current?.clientWidth ?? A4_WIDTH;
      setSize({ scale: Math.min(1, width / A4_WIDTH), height: Math.max(A4_MIN_HEIGHT, Math.ceil(result.height)) });
    }).catch((failure: unknown) => {
      if (current()) setError(failure instanceof Error ? failure.message : "preview_unavailable");
    });
    return () => { active = false; };
  }, [document, laoFont, ready]);

  return <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={l("livePreview")}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-3"><div><h2 className="font-semibold">{l("livePreview")}</h2><p className="text-xs text-muted-foreground">{l("livePreviewHint")}</p></div><Badge variant="secondary">{statusLabel ?? l("draft")}</Badge></div>
    {error ? <Alert variant="destructive" className="m-3 w-auto"><AlertDescription>{t("commercial.pdfFailed")} ({error})</AlertDescription></Alert> : null}
    <div tabIndex={0} role="region" aria-label={l("livePreview")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4">
      <div ref={viewport} className="w-full min-w-0">
        <div className="relative mx-auto max-w-full overflow-hidden rounded-sm bg-card shadow-sm ring-1 ring-border" style={{ width: A4_WIDTH * size.scale, height: size.height * size.scale }}>
          <iframe ref={frame} title={l("livePreview")} srcDoc={initialHtml} onLoad={() => { if (frame.current?.contentDocument?.querySelector(".paper")) setReady(true); }} tabIndex={-1} sandbox="allow-same-origin" scrolling="no" className="pointer-events-none absolute top-0 left-0 border-0" style={{ width: A4_WIDTH, height: size.height, transform: `scale(${size.scale})`, transformOrigin: "top left" }} />
        </div>
      </div>
    </div>
  </section>;
}
