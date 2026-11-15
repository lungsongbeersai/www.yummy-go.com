import type { EmployeeWorkResponse } from "@/services/pos";
import { requireEmployeeWorkItems } from "@/stores/employee-work-helpers";

export interface EmployeeWorkPdfOptions {
  report: EmployeeWorkResponse;
  html: string;
  fileName: string;
  isCurrent: () => boolean;
}

export interface EmployeeWorkPdfFile { file: File; pageCount: number }
export type EmployeeWorkPdfErrorCode = "invalid-report" | "font" | "layout" | "too-large" | "capture";

export class EmployeeWorkPdfError extends Error {
  constructor(readonly code: EmployeeWorkPdfErrorCode) {
    super(`Employee report PDF: ${code}`);
    this.name = "EmployeeWorkPdfError";
  }
}

export const EMPLOYEE_WORK_PDF_MAX_PAGES = 100;
export const EMPLOYEE_WORK_PDF_MAX_BYTES = 20 * 1024 * 1024;
const CONTENT_WIDTH_MM = 186;
const CONTENT_HEIGHT_MM = 273;
const MARGIN_MM = 12;
const fontFacesPath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/app-document-font-faces.css`;

/** A new empty page must fail for an oversized block rather than loop forever. */
export function employeeWorkPdfPageFit(height: number, capacity: number, hasPriorContent: boolean): "fits" | "next-page" | "too-tall" {
  if (!Number.isFinite(height) || !Number.isFinite(capacity) || height < 0 || capacity <= 0) return "too-tall";
  return height <= capacity ? "fits" : hasPriorContent ? "next-page" : "too-tall";
}

function validateReport(report: EmployeeWorkResponse) {
  if (!report.report.complete || report.data.length !== report.pagination.total) throw new EmployeeWorkPdfError("invalid-report");
  if (report.data.length > Math.min(1000, report.report.max_orders) || report.data.reduce((sum, bill) => sum + bill.items.length, 0) > 20_000) throw new EmployeeWorkPdfError("too-large");
  try { requireEmployeeWorkItems(report, report.employee.login_uuid); }
  catch { throw new EmployeeWorkPdfError("invalid-report"); }
}

async function bounded<T>(work: Promise<T>, code: EmployeeWorkPdfErrorCode): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new EmployeeWorkPdfError(code)), 15_000);
    })]);
  } finally { clearTimeout(timer); }
}

function selectedFont(source: Document) {
  switch (source.documentElement.dataset.laoFont) {
    case "noto-serif": return "App Document Noto Serif Lao";
    case "phetsarath": return "App Document Phetsarath";
    case "saysettha": return "App Document Saysettha";
    default: return "App Document Noto Sans Lao";
  }
}

function fontFamily(value: string) { return value.replace(/^["']|["']$/g, ""); }

async function loadStylesheet(link: HTMLLinkElement, assertCurrent: () => void) {
  if (link.sheet) return;
  let loaded: () => void = () => {};
  let failed: () => void = () => {};
  try {
    await bounded(new Promise<void>((resolve, reject) => {
      loaded = resolve;
      failed = () => reject(new EmployeeWorkPdfError("font"));
      link.addEventListener("load", loaded, { once: true });
      link.addEventListener("error", failed, { once: true });
      if (link.sheet) resolve();
    }), "font");
    assertCurrent();
  } finally {
    link.removeEventListener("load", loaded);
    link.removeEventListener("error", failed);
  }
}

async function drawingFonts(target: Document, family: string, baseUri: string, links: Set<HTMLLinkElement>, assertCurrent: () => void) {
  const registered = new Set(Array.from(target.fonts, face => fontFamily(face.family)));
  if (!registered.has(family) || !registered.has("App Document Noto Sans")) {
    const link = target.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(fontFacesPath, baseUri).href;
    link.dataset.employeeWorkPdfFonts = "true";
    links.add(link);
    target.head.append(link);
    await loadStylesheet(link, assertCurrent);
    assertCurrent();
  }
  for (const [name, sample] of [[family, "ລາຍການຈຳນວນ"], ["App Document Noto Sans", "ABC0123456789"]]) {
    for (const weight of [400, 700]) {
      const faces = await bounded(target.fonts.load(`${weight} 12px "${name}"`, sample), "font");
      assertCurrent();
      if (!faces.some(face => fontFamily(face.family) === name && face.status === "loaded")) throw new EmployeeWorkPdfError("font");
    }
  }
  if (family === "App Document Phetsarath") {
    // The system uses regular Arial for Phetsarath's Latin fallback and lets
    // the browser synthesize bold; its absence uses the same native fallback.
    await Promise.all([400, 700].map(weight => bounded(target.fonts.load(`${weight} 12px "App Document Phetsarath Fallback"`, "ABC"), "font").catch(() => {})));
    assertCurrent();
  }
  await bounded(target.fonts.ready, "font");
  assertCurrent();
}

async function reportFrame(html: string, assertCurrent: () => void) {
  const frame = document.createElement("iframe");
  frame.title = "Employee report PDF";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.style.cssText = "position:fixed;left:-20000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;";
  let onLoad: () => void = () => {};
  let onError: () => void = () => {};
  try {
    const ready = new Promise<Document>((resolve, reject) => {
      onLoad = () => {
        const source = frame.contentDocument;
        if (source?.querySelector(".report-header")) resolve(source);
        else reject(new EmployeeWorkPdfError("layout"));
      };
      onError = () => reject(new EmployeeWorkPdfError("layout"));
      frame.addEventListener("load", onLoad, { once: true });
      frame.addEventListener("error", onError, { once: true });
    });
    frame.srcdoc = html;
    document.body.append(frame);
    const source = await bounded(ready, "layout");
    assertCurrent();
    return { frame, source };
  } catch (error) { frame.remove(); throw error; }
  finally { frame.removeEventListener("load", onLoad); frame.removeEventListener("error", onError); }
}

interface BillPage { bill: HTMLElement; body: HTMLTableSectionElement }

function paginate(source: Document, report: EmployeeWorkResponse, assertCurrent: () => void) {
  const view = source.defaultView;
  const header = source.querySelector<HTMLElement>(".report-header");
  const bills = Array.from(source.querySelectorAll<HTMLElement>(".bill"));
  const extra = Array.from(source.body.children).filter(node => node !== header && !bills.includes(node as HTMLElement) && !["STYLE", "SCRIPT", "LINK"].includes(node.tagName));
  if (!view || !header || bills.length !== report.data.length) throw new EmployeeWorkPdfError("layout");
  source.body.style.cssText += `;width:${CONTENT_WIDTH_MM}mm;margin:0;`;
  const host = source.createElement("div");
  host.dataset.employeeWorkPdfPages = "true";
  host.style.cssText = `position:absolute;left:0;top:0;width:${CONTENT_WIDTH_MM}mm;`;
  source.body.append(host);
  const measure = source.createElement("div");
  measure.style.height = `${CONTENT_HEIGHT_MM}mm`;
  host.append(measure);
  // One CSS pixel of slack accounts for integer scrollHeight rounding.
  const capacity = measure.getBoundingClientRect().height - 1;
  measure.remove();
  const pages: HTMLElement[] = [];
  const newPage = () => {
    assertCurrent();
    if (pages.length >= EMPLOYEE_WORK_PDF_MAX_PAGES) throw new EmployeeWorkPdfError("too-large");
    const next = source.createElement("div");
    next.dataset.employeeWorkPdfPage = String(pages.length + 1);
    next.style.cssText = `display:flow-root;box-sizing:border-box;width:${CONTENT_WIDTH_MM}mm;min-height:0;height:auto;margin:0;padding:0;`;
    next.style.fontFamily = view.getComputedStyle(source.body).fontFamily;
    host.append(next);
    pages.push(next);
    return next;
  };
  const height = (page: HTMLElement) => Math.max(page.getBoundingClientRect().height, page.scrollHeight);
  const fits = (page: HTMLElement) => employeeWorkPdfPageFit(height(page), capacity, false) === "fits" && page.scrollWidth <= page.clientWidth + 1;
  let page = newPage();
  page.append(header.cloneNode(true));
  if (!fits(page)) throw new EmployeeWorkPdfError("layout");

  for (const [billIndex, original] of bills.entries()) {
    assertCurrent();
    const table = original.querySelector<HTMLTableElement>("table");
    const rows = table ? Array.from(table.tBodies).flatMap(body => Array.from(body.rows)) : [];
    if (!table || rows.length !== report.data[billIndex].items.length) throw new EmployeeWorkPdfError("layout");
    const children = Array.from(original.children);
    const before = children.slice(0, children.indexOf(table));
    const after = children.slice(children.indexOf(table) + 1);
    const startBill = (target: HTMLElement): BillPage => {
      const bill = original.cloneNode(false) as HTMLElement;
      bill.style.display = "flow-root";
      for (const node of before) bill.append(node.cloneNode(true));
      const copy = table.cloneNode(false) as HTMLTableElement;
      for (const child of Array.from(table.children)) if (child.tagName !== "TBODY" && child.tagName !== "TFOOT") copy.append(child.cloneNode(true));
      const body = source.createElement("tbody");
      copy.append(body);
      bill.append(copy);
      target.append(bill);
      return { bill, body };
    };
    let fragment = startBill(page);
    for (const row of rows) {
      const copy = row.cloneNode(true) as HTMLTableRowElement;
      const hadPriorContent = fragment.body.rows.length > 0 || page.childElementCount > 1;
      fragment.body.append(copy);
      const placement = employeeWorkPdfPageFit(height(page), capacity, hadPriorContent);
      if (placement === "fits" && fits(page)) continue;
      copy.remove();
      if (placement === "too-tall") throw new EmployeeWorkPdfError("layout");
      const previousRows = fragment.body.rows.length;
      if (previousRows === 0) fragment.bill.remove();
      const priorContent = page.childElementCount > 0;
      if (!priorContent) throw new EmployeeWorkPdfError("layout");
      page = newPage();
      fragment = startBill(page);
      fragment.body.append(copy);
      if (!fits(page)) throw new EmployeeWorkPdfError("layout");
    }
    const ending = source.createElement("div");
    for (const node of after) ending.append(node.cloneNode(true));
    if (table.tFoot) {
      const footerTable = table.cloneNode(false) as HTMLTableElement;
      footerTable.append(table.tFoot.cloneNode(true));
      ending.prepend(footerTable);
    }
    fragment.bill.append(ending);
    if (!fits(page)) {
      ending.remove();
      // Keep the final detail row with its totals. A continuation containing
      // only repeated metadata and totals loses the bill's visible context.
      const finalRow = fragment.body.rows.item(fragment.body.rows.length - 1);
      if (!finalRow) throw new EmployeeWorkPdfError("layout");
      finalRow.remove();
      if (!fragment.body.rows.length) fragment.bill.remove();
      // Reuse an emptied final page instead of leaving a blank sheet behind.
      if (page.childElementCount) page = newPage();
      fragment = startBill(page);
      fragment.body.append(finalRow);
      fragment.bill.append(ending);
      if (!fits(page)) throw new EmployeeWorkPdfError("layout");
    }
  }
  for (const original of extra) {
    const copy = original.cloneNode(true) as HTMLElement;
    page.append(copy);
    if (fits(page)) continue;
    copy.remove();
    page = newPage();
    page.append(copy);
    if (!fits(page)) throw new EmployeeWorkPdfError("layout");
  }
  const expectedRows = report.data.reduce((sum, bill) => sum + bill.items.length, 0);
  if (pages.reduce((sum, item) => sum + item.querySelectorAll("tbody > tr").length, 0) !== expectedRows) throw new EmployeeWorkPdfError("layout");
  return pages;
}

function safeFileName(value: string) {
  const name = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim().slice(0, 180) || "employee-report";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

/** Build an owned, complete report File only. Output/printing is a separate UI action. */
export async function createEmployeeWorkPdf({ report, html, fileName, isCurrent }: EmployeeWorkPdfOptions): Promise<EmployeeWorkPdfFile> {
  const assertCurrent = () => { if (!isCurrent()) throw new DOMException("Employee report export cancelled", "AbortError"); };
  assertCurrent();
  validateReport(report);
  let frame: HTMLIFrameElement | undefined;
  const links = new Set<HTMLLinkElement>();
  try {
    const prepared = await reportFrame(html, assertCurrent);
    frame = prepared.frame;
    assertCurrent();
    const source = prepared.source, family = selectedFont(source);
    await Promise.all(Array.from(source.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), link => loadStylesheet(link, assertCurrent)));
    assertCurrent();
    await Promise.all([source, document].map(target => drawingFonts(target, family, source.baseURI, links, assertCurrent)));
    assertCurrent();
    if (fontFamily(source.defaultView!.getComputedStyle(source.body).fontFamily.split(",")[0].trim()) !== family) throw new EmployeeWorkPdfError("font");
    const pages = paginate(source, report, assertCurrent);
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
    assertCurrent();
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    pdf.setProperties({ title: source.title, creator: "Yummy Go" });
    for (const [index, page] of pages.entries()) {
      assertCurrent();
      const canvas = await html2canvas(page, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: false, logging: false,
        windowWidth: 1280, windowHeight: 1400, scrollX: 0, scrollY: 0,
        onclone: async cloned => {
          try { await drawingFonts(cloned, family, source.baseURI, links, assertCurrent); assertCurrent(); }
          catch (error) { cloned.defaultView?.frameElement?.remove(); throw error; }
        },
      });
      try {
        assertCurrent();
        if (!canvas.width || !canvas.height) throw new EmployeeWorkPdfError("capture");
        if (index) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, canvas.height * CONTENT_WIDTH_MM / canvas.width);
      } finally { canvas.width = 0; canvas.height = 0; }
    }
    assertCurrent();
    const blob = pdf.output("blob");
    if (blob.size > EMPLOYEE_WORK_PDF_MAX_BYTES) throw new EmployeeWorkPdfError("too-large");
    assertCurrent();
    return { file: new File([blob], safeFileName(fileName), { type: "application/pdf" }), pageCount: pages.length };
  } catch (error) {
    if (error instanceof EmployeeWorkPdfError || error instanceof DOMException && error.name === "AbortError") throw error;
    throw new EmployeeWorkPdfError("capture");
  } finally { frame?.remove(); for (const link of links) link.remove(); }
}
