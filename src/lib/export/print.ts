import { isCapacitorAndroidApp } from "@/lib/capacitor-platform";
import { printHtmlWithAndroidSystemPrint } from "@/lib/android-system-print";
import { createFileExportGuard, type SaveExportFileOptions } from "@/lib/export/file-output";

function escapeAttribute(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function renderExportPrintDocument({ content, title, baseUrl, styles, htmlAttributes }: {
  content: string; title: string; baseUrl: string; styles: string; htmlAttributes: Record<string, string>;
}) {
  const attributes = Object.entries(htmlAttributes).filter(([name]) => /^(?:class|lang|dir|data-[\w-]+)$/.test(name))
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(" ");
  return `<!doctype html><html ${attributes}><head><meta charset="UTF-8"><base href="${escapeAttribute(baseUrl)}"><title>${escapeAttribute(title)}</title>${styles}</head><body>${content}</body></html>`;
}

/** Native WebView has no browser print UI; send the prepared report to PrintManager. */
export async function printExportElement(element: HTMLElement, options: SaveExportFileOptions & { title: string; orientation?: "landscape" | "portrait" }) {
  const isCurrent = createFileExportGuard(options.isCurrent);
  if (!isCurrent()) throw new DOMException("Print cancelled", "AbortError");
  if (!isCapacitorAndroidApp()) { window.print(); return; }
  const source = element.ownerDocument;
  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add("report-print-surface");
  Object.assign(clone.style, { position: "static", left: "auto", top: "auto", visibility: "visible", opacity: "1", display: "block", transform: "none", width: "100%", maxWidth: "none" });
  clone.querySelectorAll("script").forEach(script => script.remove());
  const attributes = Object.fromEntries(Array.from(source.documentElement.attributes).map(attribute => [attribute.name, attribute.value]));
  const styles = Array.from(source.querySelectorAll('link[rel="stylesheet"], style')).map(style => style.outerHTML).join("");
  const html = renderExportPrintDocument({ content: clone.outerHTML, title: options.title, baseUrl: source.baseURI, styles, htmlAttributes: attributes });
  if (!isCurrent()) throw new DOMException("Print cancelled", "AbortError");
  if (!await printHtmlWithAndroidSystemPrint({ html, jobName: options.title, orientation: options.orientation ?? "landscape", colorMode: "color", isCurrent })) throw new Error("Update the Yummy Go Android app to print this report.");
}

export async function printExportHtml(html: string, options: SaveExportFileOptions & { title: string; orientation?: "landscape" | "portrait" }) {
  const isCurrent = createFileExportGuard(options.isCurrent);
  if (!isCurrent()) throw new DOMException("Print cancelled", "AbortError");
  if (!isCapacitorAndroidApp()) return false;
  if (!await printHtmlWithAndroidSystemPrint({ html, jobName: options.title, orientation: options.orientation, colorMode: "color", isCurrent })) throw new Error("Update the Yummy Go Android app to print this report.");
  return true;
}
