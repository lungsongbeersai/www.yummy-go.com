"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

interface EmployeeWorkReportPreviewProps {
  html: string;
  title: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  isCurrent: () => boolean;
  onReady: () => void;
  onError: () => void;
}

async function prepareReportFonts(doc: Document, signal: AbortSignal) {
  const view = doc.defaultView;
  if (!view) throw new Error("Report frame unavailable");
  const familyName = () => view.getComputedStyle(doc.body).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const definitionsReady = () => {
    const registered = new Set(Array.from(doc.fonts, face => face.family.replace(/^["']|["']$/g, "")));
    return familyName().startsWith("App Document ") && registered.has(familyName()) && registered.has("App Document Noto Sans");
  };
  const cleanups: (() => void)[] = [];
  try {
    const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    if (!links.length) throw new Error("Report stylesheet missing");
    await Promise.all(links.map(link => {
      if (link.sheet && definitionsReady()) return;
      return new Promise<void>((resolve, reject) => {
        const loaded = () => resolve();
        const failed = () => reject(new Error("Report stylesheet unavailable"));
        const aborted = () => reject(new DOMException("Report cancelled", "AbortError"));
        link.addEventListener("load", loaded, { once: true });
        link.addEventListener("error", failed, { once: true });
        signal.addEventListener("abort", aborted, { once: true });
        cleanups.push(() => { link.removeEventListener("load", loaded); link.removeEventListener("error", failed); signal.removeEventListener("abort", aborted); });
        if (signal.aborted) aborted();
        else if (link.sheet && definitionsReady()) loaded();
      });
    }));
    if (signal.aborted || !definitionsReady()) throw new Error("Report font definitions unavailable");
    const family = view.getComputedStyle(doc.body).fontFamily;
    const loaded = await Promise.race([
      Promise.all([400, 700].map(weight => doc.fonts.load(`${weight} 12px ${family}`, "ລາຍງານ ABC 0123456789"))).then(async faces => { await doc.fonts.ready; return faces; }),
      new Promise<never>((_, reject) => {
        const aborted = () => reject(new DOMException("Report cancelled", "AbortError"));
        signal.addEventListener("abort", aborted, { once: true });
        cleanups.push(() => signal.removeEventListener("abort", aborted));
        if (signal.aborted) aborted();
      }),
    ]);
    if (signal.aborted || loaded.some(faces => !faces.some(face => face.family.replace(/^["']|["']$/g, "") === familyName() && face.status === "loaded"))) throw new Error("Report font unavailable");
  } finally { cleanups.forEach(cleanup => cleanup()); }
}

/** The preview keeps the renderer's A4 content width; only the outer screen is scaled. */
export function EmployeeWorkReportPreview({ html, title, frameRef, isCurrent, onReady, onError }: EmployeeWorkReportPreviewProps) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ isCurrent, onReady, onError });
  useLayoutEffect(() => { callbacks.current = { isCurrent, onReady, onError }; }, [isCurrent, onReady, onError]);
  const controller = useRef<AbortController | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(false);
  const [size, setSize] = useState({ height: 1123, scale: 1 });

  useEffect(() => {
    mounted.current = true;
    deadline.current = setTimeout(() => {
      controller.current?.abort();
      if (mounted.current && callbacks.current.isCurrent()) callbacks.current.onError();
    }, 15_000);
    const node = host.current;
    const measure = () => {
      if (!node || node.clientWidth <= 0) return;
      setSize(current => ({ ...current, scale: Math.min(1, node.clientWidth / 794) }));
    };
    const observer = new ResizeObserver(measure);
    if (node) observer.observe(node);
    measure();
    return () => {
      mounted.current = false;
      clearTimeout(deadline.current);
      controller.current?.abort();
      observer.disconnect();
    };
  }, []);

  async function prepare(element: HTMLIFrameElement) {
    const doc = element.contentDocument;
    if (!doc?.querySelector(".report-header")) return;
    controller.current?.abort();
    const operation = new AbortController();
    controller.current = operation;
    const current = () => mounted.current && !operation.signal.aborted && callbacks.current.isCurrent() && frameRef.current?.contentDocument === doc;
    try {
      await prepareReportFonts(doc, operation.signal);
      if (!current()) return;
      doc.body.style.padding = "12mm";
      doc.body.style.minHeight = "297mm";
      const style = doc.createElement("style");
      style.textContent = "@media print{body{padding:0!important;min-height:0!important}}";
      doc.head.append(style);
      setSize(previous => ({ ...previous, height: Math.ceil(Math.max(1123, doc.body.getBoundingClientRect().height)) }));
      clearTimeout(deadline.current);
      callbacks.current.onReady();
    } catch {
      if (current()) { clearTimeout(deadline.current); callbacks.current.onError(); }
    }
  }

  return <div className="rounded-xl border border-border bg-muted/40 p-2 sm:p-4">
    <div ref={host} className="w-full min-w-0">
      <div className="relative mx-auto overflow-hidden shadow-sm" style={{ width: 794 * size.scale, height: size.height * size.scale }}>
        <iframe ref={frameRef} title={title} srcDoc={html} sandbox="allow-same-origin allow-modals" tabIndex={-1} onLoad={event => void prepare(event.currentTarget)} className="absolute top-0 left-0 origin-top-left border-0" style={{ width: 794, height: size.height, transform: `scale(${size.scale})` }} />
      </div>
    </div>
  </div>;
}
