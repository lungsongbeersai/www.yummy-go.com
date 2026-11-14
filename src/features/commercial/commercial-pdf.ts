"use client";

import type { jsPDF as PdfDocument } from "jspdf";
import { updateCommercialPreview, CommercialPageLayoutError } from "./commercial-page-layout";
import { COMMERCIAL_PAPER, commercialContentHeightForWidth } from "./commercial-paper";
import { downloadCommercialPdfFile, type CommercialPdfDownload } from "./commercial-pdf-download";

export class CommercialPdfError extends Error {
  constructor(readonly code: "layout" | "image" | "font", message: string) {
    super(message);
    this.name = "CommercialPdfError";
  }
}

async function bounded<T>(work: Promise<T>, code: "image" | "font") {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CommercialPdfError(code, `Unable to load document ${code}s`)), 15_000);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface DrawingFontStylesheet { link: HTMLLinkElement; ready: Promise<void> }
const drawingFontStylesheets = new WeakMap<Document, DrawingFontStylesheet>();
const fontFacesPath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/app-document-font-faces.css`;
const latinFont = "App Document Noto Sans";

function laoDocumentFont(source: Document) {
  switch (source.documentElement.dataset.laoFont) {
    case "noto-serif": return "App Document Noto Serif Lao";
    case "phetsarath": return "App Document Phetsarath";
    case "saysettha": return "App Document Saysettha";
    default: return "App Document Noto Sans Lao";
  }
}

async function ensureDrawingFontStylesheet(target: Document, baseUri: string) {
  let stylesheet = drawingFontStylesheets.get(target);
  if (!stylesheet) {
    const link = target.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(fontFacesPath, baseUri).href;
    link.dataset.commercialPdfFonts = "true";
    const ready = bounded(new Promise<void>((resolve, reject) => {
      link.addEventListener("load", () => resolve(), { once: true });
      link.addEventListener("error", () => reject(new CommercialPdfError("font", "Unable to load document font definitions")), { once: true });
      target.head.append(link);
    }), "font").catch((error: unknown) => {
      drawingFontStylesheets.delete(target);
      link.remove();
      throw error;
    });
    stylesheet = { link, ready };
    drawingFontStylesheets.set(target, stylesheet);
  }
  await stylesheet.ready;
  return stylesheet;
}

async function prepareDrawingFonts(source: Document) {
  // html2canvas creates canvases in its module's document (the app), while the
  // preview's @font-face declarations belong to a separate iframe document.
  const drawingDocument = globalThis.document;
  let drawingStylesheet: DrawingFontStylesheet | undefined;
  if (drawingDocument !== source) {
    drawingStylesheet = await ensureDrawingFontStylesheet(drawingDocument, source.baseURI);
  }
  const requestedFonts = [[laoDocumentFont(source), "ລາຍການຈຳນວນ"], [latinFont, "ABC0123456789"]] as const;
  try {
    await Promise.all(Array.from(new Set([source, drawingDocument]), async (target) => {
      for (const [family, sample] of requestedFonts) {
        for (const weight of [400, 700]) {
          const faces = await bounded(target.fonts.load(`${weight} 12px "${family}"`, sample), "font");
          // A mixed-script fallback load can succeed without the chosen Lao face.
          if (!faces.some((face) => face.family.replace(/^["']|["']$/g, "") === family && face.status === "loaded")) {
            throw new CommercialPdfError("font", `Document font is unavailable: ${family}`);
          }
        }
      }
      if (source.documentElement.dataset.laoFont === "phetsarath") {
        // Match the UI's regular Arial fallback, including synthesized bold.
        // Some platforms lack local Arial and use their native fallback instead.
        await Promise.all([400, 700].map((weight) => bounded(target.fonts.load(`${weight} 12px "App Document Phetsarath Fallback"`, "ABC"), "font").catch(() => {})));
      }
      await bounded(target.fonts.ready, "font");
    }));
  } catch (error) {
    if (drawingStylesheet && drawingFontStylesheets.get(drawingDocument) === drawingStylesheet) {
      drawingFontStylesheets.delete(drawingDocument);
      drawingStylesheet.link.remove();
    }
    throw error instanceof CommercialPdfError ? error : new CommercialPdfError("font", "Unable to load document fonts");
  }
}

async function normalizeImages(element: HTMLElement, document: Document, cache: Map<string, Promise<string>>) {
  for (const image of element.querySelectorAll("img")) {
    const url = new URL(image.currentSrc || image.getAttribute("src") || "", document.baseURI).href;
    let encoded = cache.get(url);
    if (!encoded) {
      encoded = (async () => {
        const safeImage = document.createElement("img");
        // Reload with CORS before drawing: a normally displayed remote image
        // can taint a canvas, which html2canvas otherwise silently omits.
        safeImage.crossOrigin = "anonymous";
        safeImage.src = url;
        await bounded(safeImage.decode(), "image");
        if (!safeImage.naturalWidth || !safeImage.naturalHeight) throw new Error("Empty image");
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1600 / Math.max(safeImage.naturalWidth, safeImage.naturalHeight));
        canvas.width = Math.max(1, Math.round(safeImage.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(safeImage.naturalHeight * scale));
        try {
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          if (image.classList.contains("payment-qr")) context.imageSmoothingEnabled = false;
          context.drawImage(safeImage, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/png");
        } finally { canvas.width = 0; canvas.height = 0; }
      })();
      cache.set(url, encoded);
    }
    try {
      image.removeAttribute("srcset");
      image.removeAttribute("loading");
      image.src = await encoded;
      await bounded(image.decode(), "image");
    } catch {
      throw new CommercialPdfError("image", `Unable to include image: ${image.alt || "document photo"}`);
    }
  }
}

/** Capture the exact prepared pages used by preview, printing and sharing. */
async function buildCommercialPdf(sourceDocument: Document, isCurrent: () => boolean): Promise<{ pdf: PdfDocument; pageCount: number }> {
  const assertCurrent = () => { if (!isCurrent()) throw new DOMException("Document export cancelled", "AbortError"); };
  assertCurrent();
  const source = sourceDocument.querySelector<HTMLElement>("[data-commercial-source]") ?? sourceDocument.querySelector<HTMLElement>(".paper");
  const view = sourceDocument.defaultView;
  if (!source || !view) throw new CommercialPdfError("layout", "The document preview is not ready");
  const host = sourceDocument.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${COMMERCIAL_PAPER.contentWidthMm}mm;pointer-events:none;`;
  sourceDocument.body.append(host);
  try {
    const stylesheets = Array.from(sourceDocument.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    await bounded(Promise.all(stylesheets.map((link) => link.sheet ? Promise.resolve() : new Promise<void>((resolve, reject) => {
      link.addEventListener("load", () => resolve(), { once: true });
      link.addEventListener("error", () => reject(new CommercialPdfError("font", "Unable to load document fonts")), { once: true });
    }))), "font");
    await prepareDrawingFonts(sourceDocument);
    assertCurrent();
    let printPages = Array.from(sourceDocument.querySelectorAll<HTMLElement>("[data-commercial-pages] [data-commercial-page]"));
    try {
      if (!printPages.length) {
        await updateCommercialPreview(sourceDocument);
        printPages = Array.from(sourceDocument.querySelectorAll<HTMLElement>("[data-commercial-pages] [data-commercial-page]"));
      }
    } catch (error) {
      throw error instanceof CommercialPageLayoutError ? new CommercialPdfError("layout", error.message) : error;
    }
    if (!printPages.length) throw new CommercialPdfError("layout", "The print pages are not ready");
    const imageCache = new Map<string, Promise<string>>();
    const pages: HTMLElement[] = [];
    for (const printPage of printPages) {
      assertCurrent();
      const original = printPage.getBoundingClientRect();
      const page = printPage.cloneNode(true) as HTMLElement;
      // Freeze the already arranged print page instead of independently
      // rebuilding its rows, filler and ending from the canonical source.
      page.style.cssText = `width:${COMMERCIAL_PAPER.contentWidthMm}mm;max-width:none;height:auto;min-height:0;margin:0;padding:0;display:flow-root;box-sizing:border-box;`;
      page.style.fontFamily = view.getComputedStyle(printPage).fontFamily;
      host.append(page);
      await normalizeImages(page, sourceDocument, imageCache);
      assertCurrent();
      const copy = page.getBoundingClientRect();
      if (original.width <= 0 || Math.abs(copy.width - original.width) > 1 || Math.abs(copy.height - original.height) > 1) {
        throw new CommercialPdfError("layout", "The print layout changed before export; refresh the preview and try again");
      }
      pages.push(page);
    }
    const fits = (page: HTMLElement) => page.getBoundingClientRect().height <= commercialContentHeightForWidth(page.getBoundingClientRect().width) - 1 && page.scrollWidth <= page.clientWidth + 1;
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    pdf.setProperties({ title: sourceDocument.title, creator: "Yummy Go" });
    for (const [index, page] of pages.entries()) {
      assertCurrent();
      await Promise.all(Array.from(page.querySelectorAll("img"), (image) => bounded(image.decode(), "image")));
      if (!fits(page)) throw new CommercialPdfError("layout", "The document layout changed before export");
      const canvas = await html2canvas(page, {
        // 96 CSS pixels per inch × 3.125 gives 300 dpi at the fixed A4 width.
        scale: 3.125, backgroundColor: "#ffffff", useCORS: false, allowTaint: false, logging: false,
        windowWidth: 1280, windowHeight: 1400, scrollX: 0, scrollY: 0,
        onclone: async (clonedDocument, element) => {
          const parent = element.parentElement;
          if (parent) { parent.style.left = "0"; parent.style.top = "0"; }
          // Its clone is a third document, with an independent FontFaceSet.
          try {
            await ensureDrawingFontStylesheet(clonedDocument, sourceDocument.baseURI);
            await prepareDrawingFonts(clonedDocument);
          } catch (error) {
            // html2canvas has not entered its render cleanup when onclone fails.
            clonedDocument.defaultView?.frameElement?.remove();
            throw error;
          }
        },
      });
      try {
        assertCurrent();
        if (index > 0) pdf.addPage();
        // Lossless pages preserve small Lao glyphs, table rules and QR modules.
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", COMMERCIAL_PAPER.horizontalMarginMm, COMMERCIAL_PAPER.verticalMarginMm, COMMERCIAL_PAPER.contentWidthMm, canvas.height * COMMERCIAL_PAPER.contentWidthMm / canvas.width);
      } finally { canvas.width = 0; canvas.height = 0; }
    }
    return { pdf, pageCount: pages.length };
  } finally { host.remove(); }
}

function pdfFileName(fileName: string) {
  const name = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim() || "commercial-document";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

export async function createCommercialPdf(sourceDocument: Document, fileName: string, isCurrent: () => boolean = () => true): Promise<{ file: File; pageCount: number }> {
  const { pdf, pageCount } = await buildCommercialPdf(sourceDocument, isCurrent);
  if (!isCurrent()) throw new DOMException("Document export cancelled", "AbortError");
  return { file: new File([pdf.output("blob")], pdfFileName(fileName), { type: "application/pdf" }), pageCount };
}

export async function downloadCommercialPdf(sourceDocument: Document, fileName: string, isCurrent: () => boolean = () => true): Promise<{ pageCount: number; download: CommercialPdfDownload }> {
  const { file, pageCount } = await createCommercialPdf(sourceDocument, fileName, isCurrent);
  if (!isCurrent()) throw new DOMException("Document export cancelled", "AbortError");
  return { pageCount, download: downloadCommercialPdfFile(file, isCurrent) };
}
