"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { renderCommercialDocument } from "@/features/commercial/commercial-print";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import type { CommercialDocument } from "@/services/commercial";
import { useAppStore } from "@/stores/app-store";

interface CommercialLivePreviewProps { document: CommercialDocument }

const A4_WIDTH = 794;
const A4_MIN_HEIGHT = 1123;
const PAGE_PADDING = 14 * 96 / 25.4;

export function CommercialLivePreview({ document }: CommercialLivePreviewProps) {
  const l = useCommercialLabels();
  const laoFont = useAppStore((state) => state.laoFont);
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ scale: 1, height: A4_MIN_HEIGHT });
  const [initialHtml] = useState(() => renderCommercialDocument(document, { laoFont }));

  useEffect(() => {
    const target = frame.current?.contentDocument;
    const paper = target?.querySelector<HTMLElement>(".paper");
    if (!ready || !target || !paper || !viewport.current) return;
    let active = true;
    let paint = 0;
    const measure = () => {
      if (!active) return;
      const width = viewport.current?.clientWidth ?? 0;
      if (!width) return;
      // Measure paper content rather than root.scrollHeight, which includes the
      // old iframe viewport and prevents shrinking after long rows are removed.
      const height = Math.max(A4_MIN_HEIGHT, Math.ceil(paper.getBoundingClientRect().height + PAGE_PADDING * 2));
      const scale = Math.min(1, width / A4_WIDTH);
      setSize((previous) => previous.height === height && previous.scale === scale ? previous : { scale, height });
    };
    const schedule = () => { if (active) { cancelAnimationFrame(paint); paint = requestAnimationFrame(measure); } };
    const style = target.createElement("style");
    style.id = "commercial-live-layout";
    // Preview-only A4 margins match the saved document/PDF without changing
    // the shared renderer or any application-wide styles.
    style.textContent = "html{overflow:hidden}body{width:210mm;min-height:297mm;padding:14mm 12mm!important;overflow:hidden}.paper{width:100%;max-width:none;margin:0;padding:0;display:flow-root}";
    target.head.append(style);
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport.current);
    observer.observe(paper);
    schedule();
    void target.fonts.ready.then(schedule);
    return () => { active = false; cancelAnimationFrame(paint); observer.disconnect(); style.remove(); };
  }, [ready]);

  useEffect(() => {
    const target = frame.current?.contentDocument;
    const paper = target?.querySelector<HTMLElement>(".paper");
    if (!ready || !target || !paper) return;
    const rendered = new DOMParser().parseFromString(renderCommercialDocument(document, { laoFont }), "text/html");
    const nextPaper = rendered.querySelector(".paper");
    if (!nextPaper) return;
    // Only escaped renderer output enters the live document; keeping its head
    // and iframe intact preserves fonts, input focus and the outer scroll pane.
    paper.innerHTML = nextPaper.innerHTML;
    target.querySelector("title")?.replaceChildren(target.createTextNode(rendered.title));
    target.documentElement.setAttribute("data-lao-font", laoFont);
  }, [document, laoFont, ready]);

  return <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={l("livePreview")}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-3"><div><h2 className="font-semibold">{l("livePreview")}</h2><p className="text-xs text-muted-foreground">{l("livePreviewHint")}</p></div><Badge variant="secondary">{l("draft")}</Badge></div>
    <div tabIndex={0} role="region" aria-label={l("livePreview")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4">
      <div ref={viewport} className="w-full min-w-0">
        <div className="relative mx-auto max-w-full overflow-hidden rounded-sm bg-card shadow-sm ring-1 ring-border" style={{ width: A4_WIDTH * size.scale, height: size.height * size.scale }}>
          <iframe ref={frame} title={l("livePreview")} srcDoc={initialHtml} onLoad={() => { if (frame.current?.contentDocument?.querySelector(".paper")) setReady(true); }} tabIndex={-1} sandbox="allow-same-origin" scrolling="no" className="pointer-events-none absolute top-0 left-0 border-0" style={{ width: A4_WIDTH, height: size.height, transform: `scale(${size.scale})`, transformOrigin: "top left" }} />
        </div>
      </div>
    </div>
  </section>;
}
