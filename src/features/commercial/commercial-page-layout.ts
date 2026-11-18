import { COMMERCIAL_PAPER, commercialContentHeightForWidth } from "./commercial-paper";

export class CommercialPageLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommercialPageLayoutError";
  }
}

const sourceStyles = new WeakMap<HTMLElement, { style: string | null; ariaHidden: string | null }>();

async function readyWithin(work: Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CommercialPageLayoutError("Unable to load document fonts or images before layout")), 15_000);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Keep original rows whole, then use spare A4 space without changing the data. */
export function buildCommercialPages(template: HTMLElement, host: HTMLElement): HTMLElement[] {
  const created: HTMLElement[] = [];
  try {
    const table = template.querySelector<HTMLTableElement>("table");
    if (!table?.tHead || table.tBodies.length !== 1) throw new CommercialPageLayoutError("The document table is not ready");
    const children = Array.from(template.children);
    const tableIndex = children.indexOf(table);
    if (tableIndex < 0) throw new CommercialPageLayoutError("Unsupported document layout");
    const width = template.getBoundingClientRect().width;
    if (!Number.isFinite(width) || width <= 0) throw new CommercialPageLayoutError("The document width is not ready");
    const maximumHeight = commercialContentHeightForWidth(width) - 2;
    const before = children.slice(0, tableIndex);
    const after = children.slice(tableIndex + 1);
    const columns = Math.max(...Array.from(table.tHead.rows, row => Array.from(row.cells).reduce((sum, cell) => sum + cell.colSpan, 0)));
    if (!Number.isFinite(columns) || columns < 1) throw new CommercialPageLayoutError("The document columns are not ready");
    const pages: HTMLElement[] = [];
    const makePage = (includeEnd = false) => {
      const page = template.cloneNode(false) as HTMLElement;
      page.removeAttribute("data-commercial-source");
      page.removeAttribute("aria-hidden");
      page.removeAttribute("hidden");
      page.dataset.commercialPage = "true";
      before.forEach(node => page.append(node.cloneNode(true)));
      const pageTable = table.cloneNode(true) as HTMLTableElement;
      pageTable.tBodies[0].textContent = "";
      page.append(pageTable);
      if (includeEnd) after.forEach(node => page.append(node.cloneNode(true)));
      host.append(page);
      created.push(page);
      return page;
    };
    const fits = (page: HTMLElement) => page.getBoundingClientRect().height <= maximumHeight && page.scrollWidth <= page.clientWidth + 1;
    let current = makePage();
    if (!fits(current)) throw new CommercialPageLayoutError("The document header is too tall for A4");
    const rows = Array.from(table.tBodies[0].rows).filter(row => !row.classList.contains("table-fill"));
    for (const [index, row] of rows.entries()) {
      const clone = row.cloneNode(true) as HTMLTableRowElement;
      current.querySelector("tbody")!.append(clone);
      if (!fits(current)) {
        clone.remove();
        pages.push(current);
        current = makePage();
        current.querySelector("tbody")!.append(clone);
        if (!fits(current)) throw new CommercialPageLayoutError(`Item ${index + 1} is too tall or wide for A4; shorten its description`);
      }
    }
    pages.push(current);
    const ending = after.map(node => node.cloneNode(true));
    current.append(...ending);
    if (!fits(current)) {
      ending.forEach(node => node.parentNode?.removeChild(node));
      const finalPage = makePage(true);
      if (!fits(finalPage)) throw new CommercialPageLayoutError("The totals, notes and signatures exceed one A4 page; shorten the notes");
      // Move only a contiguous suffix, preserving row order across page breaks.
      while (pages.length) {
        const previous = pages[pages.length - 1];
        const row = previous.querySelector("tbody")!.lastElementChild;
        if (!row) { previous.remove(); pages.pop(); continue; }
        finalPage.querySelector("tbody")!.prepend(row);
        if (!fits(finalPage)) { previous.querySelector("tbody")!.append(row); break; }
      }
      pages.push(finalPage);
    }
    for (const page of pages) {
      const body = page.querySelector("tbody")!;
      const filler = template.ownerDocument.createElement("tr");
      filler.className = "table-fill";
      filler.setAttribute("aria-hidden", "true");
      filler.style.height = "0px";
      for (let index = 0; index < columns; index++) {
        const cell = template.ownerDocument.createElement("td");
        cell.style.cssText = "padding:0;line-height:0;font-size:0;border-bottom:0;";
        filler.append(cell);
      }
      body.append(filler);
      let spare = Math.max(0, maximumHeight - page.getBoundingClientRect().height);
      filler.style.height = `${spare}px`;
      const excess = page.getBoundingClientRect().height - maximumHeight;
      if (excess > 0) {
        spare = Math.max(0, spare - excess - 0.1);
        filler.style.height = `${spare}px`;
      }
      if (!fits(page)) throw new CommercialPageLayoutError("The document layout changed while fitting A4 pages");
    }
    return pages;
  } catch (error) {
    created.forEach(page => page.remove());
    throw error instanceof CommercialPageLayoutError ? error : new CommercialPageLayoutError("Unable to arrange the document on A4 pages");
  }
}

/** Replace complete preview pages atomically, retaining the canonical draft. */
export async function updateCommercialPreview(doc: Document, isCurrent: () => boolean = () => true): Promise<{ pageCount: number; height: number } | null> {
  const source = doc.querySelector<HTMLElement>("[data-commercial-source]") ?? doc.querySelector<HTMLElement>(".paper");
  if (!source || !doc.defaultView) {
    if (!isCurrent()) return null;
    throw new CommercialPageLayoutError("The document preview is not ready");
  }
  let host: HTMLElement | undefined;
  let wrapper: HTMLElement | undefined;
  try {
    const family = doc.defaultView.getComputedStyle(source).fontFamily;
    // A newly selected face may not join fonts.ready until style resolution.
    source.getBoundingClientRect();
    const fonts = Promise.all([400, 700].map(weight => doc.fonts.load(`${weight} 12px ${family}`, "ລາຍການ ABC0123456789"))).then(() => doc.fonts.ready);
    await readyWithin(Promise.all([fonts, Promise.all(Array.from(source.querySelectorAll("img"), async image => {
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new CommercialPageLayoutError("Unable to load document images before layout");
    }))]));
    if (!isCurrent()) return null;
    host = doc.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${COMMERCIAL_PAPER.contentWidthMm}mm;pointer-events:none;`;
    doc.body.append(host);
    const template = source.cloneNode(true) as HTMLElement;
    template.removeAttribute("data-commercial-source");
    template.removeAttribute("hidden");
    template.style.cssText = `position:static;width:${COMMERCIAL_PAPER.contentWidthMm}mm;max-width:none;height:auto;min-height:0;margin:0;padding:0;display:flow-root;box-sizing:border-box;`;
    template.style.fontFamily = family;
    host.append(template);
    const pages = buildCommercialPages(template, host);
    wrapper = doc.createElement("div");
    wrapper.dataset.commercialPages = "true";
    wrapper.className = "commercial-pages";
    for (const page of pages) {
      const outer = doc.createElement("div");
      outer.className = "commercial-preview-page";
      outer.append(page);
      wrapper.append(outer);
    }
    if (!isCurrent()) return null;
    if (!sourceStyles.has(source)) sourceStyles.set(source, { style: source.getAttribute("style"), ariaHidden: source.getAttribute("aria-hidden") });
    source.dataset.commercialSource = "true";
    source.style.cssText = `position:fixed;left:-20000px;top:0;width:${COMMERCIAL_PAPER.contentWidthMm}mm;max-width:none;margin:0;padding:0;display:flow-root;pointer-events:none;`;
    source.setAttribute("aria-hidden", "true");
    const previous = doc.querySelector<HTMLElement>("[data-commercial-pages]");
    if (previous) previous.replaceWith(wrapper);
    else doc.body.append(wrapper);
    doc.body.classList.add("commercial-paginated");
    return { pageCount: pages.length, height: wrapper.getBoundingClientRect().height };
  } catch (error) {
    if (!isCurrent()) return null;
    wrapper?.remove();
    doc.querySelector("[data-commercial-pages]")?.remove();
    doc.body.classList.remove("commercial-paginated");
    const original = sourceStyles.get(source);
    if (original) {
      if (original.style === null) source.removeAttribute("style");
      else source.setAttribute("style", original.style);
      if (original.ariaHidden === null) source.removeAttribute("aria-hidden");
      else source.setAttribute("aria-hidden", original.ariaHidden);
    }
    throw error instanceof CommercialPageLayoutError ? error : new CommercialPageLayoutError("Unable to load document fonts or images before layout");
  } finally {
    host?.remove();
  }
}
