"use client";

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

async function normalizeImages(element: HTMLElement, document: Document) {
  const cache = new Map<string, Promise<string>>();
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

/** Measure and capture independent A4 pages, keeping every table row intact. */
export async function downloadCommercialPdf(sourceDocument: Document, fileName: string): Promise<{ pageCount: number }> {
  const source = sourceDocument.querySelector<HTMLElement>(".paper");
  const view = sourceDocument.defaultView;
  if (!source || !view) throw new CommercialPdfError("layout", "The document preview is not ready");
  const host = sourceDocument.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-20000px;top:0;width:186mm;pointer-events:none;";
  sourceDocument.body.append(host);
  const template = source.cloneNode(true) as HTMLElement;
  template.style.cssText = "width:186mm;max-width:none;margin:0;padding:0;display:flow-root;box-sizing:border-box;";
  host.append(template);
  try {
    const stylesheets = Array.from(sourceDocument.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    await bounded(Promise.all(stylesheets.map((link) => link.sheet ? Promise.resolve() : new Promise<void>((resolve, reject) => {
      link.addEventListener("load", () => resolve(), { once: true });
      link.addEventListener("error", () => reject(new CommercialPdfError("font", "Unable to load document fonts")), { once: true });
    }))), "font");
    const font = view.getComputedStyle(template).fontFamily;
    const loaded = await bounded(Promise.all([sourceDocument.fonts.load(`400 12px ${font}`, "ລາຍການ LAK"), sourceDocument.fonts.load(`700 22px ${font}`, "ລາຍການ LAK")]), "font");
    if (loaded.some((faces) => !faces.length)) throw new CommercialPdfError("font", "Document fonts are unavailable");
    await bounded(sourceDocument.fonts.ready, "font");
    await normalizeImages(template, sourceDocument);
    const table = template.querySelector<HTMLTableElement>("table");
    if (!table?.tHead || table.tBodies.length !== 1) throw new CommercialPdfError("layout", "The document table is not ready");
    const children = Array.from(template.children);
    const tableIndex = children.indexOf(table);
    if (tableIndex < 0) throw new CommercialPdfError("layout", "Unsupported document layout");
    const before = children.slice(0, tableIndex);
    const after = children.slice(tableIndex + 1);
    const maximumHeight = template.getBoundingClientRect().width * 269 / 186 - 2;
    const pages: HTMLElement[] = [];
    const makePage = (includeEnd = false) => {
      const page = template.cloneNode(false) as HTMLElement;
      before.forEach((node) => page.append(node.cloneNode(true)));
      const pageTable = table.cloneNode(true) as HTMLTableElement;
      pageTable.tBodies[0].replaceChildren();
      page.append(pageTable);
      if (includeEnd) after.forEach((node) => page.append(node.cloneNode(true)));
      host.append(page);
      return page;
    };
    const fits = (page: HTMLElement) => page.getBoundingClientRect().height <= maximumHeight && page.scrollWidth <= page.clientWidth + 1;
    let current = makePage();
    if (!fits(current)) throw new CommercialPdfError("layout", "The document header is too tall for A4");
    for (const [index, row] of Array.from(table.tBodies[0].rows).entries()) {
      const clone = row.cloneNode(true) as HTMLTableRowElement;
      current.querySelector("tbody")!.append(clone);
      if (!fits(current)) {
        clone.remove();
        pages.push(current);
        current = makePage();
        current.querySelector("tbody")!.append(clone);
        if (!fits(current)) throw new CommercialPdfError("layout", `Item ${index + 1} is too tall or wide for A4; shorten its description`);
      }
    }
    pages.push(current);
    const ending = after.map((node) => node.cloneNode(true) as Element);
    current.append(...ending);
    if (!fits(current)) {
      ending.forEach((node) => node.remove());
      const finalPage = makePage(true);
      if (!fits(finalPage)) throw new CommercialPdfError("layout", "The totals, notes and signatures exceed one A4 page; shorten the notes");
      // Move a contiguous suffix onto the final page so totals/signatures stay
      // together, with the last item rows whenever there is enough space.
      while (pages.length) {
        const previous = pages[pages.length - 1];
        const row = previous.querySelector("tbody")!.lastElementChild;
        if (!row) { previous.remove(); pages.pop(); continue; }
        finalPage.querySelector("tbody")!.prepend(row);
        if (!fits(finalPage)) { previous.querySelector("tbody")!.append(row); break; }
      }
      pages.push(finalPage);
    }
    template.remove();
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    pdf.setProperties({ title: sourceDocument.title, creator: "Yummy Go" });
    for (const [index, page] of pages.entries()) {
      await Promise.all(Array.from(page.querySelectorAll("img"), (image) => bounded(image.decode(), "image")));
      if (!fits(page)) throw new CommercialPdfError("layout", "The document layout changed before export");
      const canvas = await html2canvas(page, {
        scale: 2.5, backgroundColor: "#ffffff", useCORS: false, allowTaint: false, logging: false,
        windowWidth: 1280, windowHeight: 1400, scrollX: 0, scrollY: 0,
        onclone: (_, element) => {
          const parent = element.parentElement;
          if (parent) { parent.style.left = "0"; parent.style.top = "0"; }
        },
      });
      try {
        if (index > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 12, 14, 186, canvas.height * 186 / canvas.width);
      } finally { canvas.width = 0; canvas.height = 0; }
    }
    await pdf.save(fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`, { returnPromise: true });
    return { pageCount: pages.length };
  } finally { host.remove(); }
}
