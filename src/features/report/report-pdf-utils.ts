interface PdfDocument {
  addImage: (
    imageData: string,
    format: "PNG",
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  addPage: () => void;
  internal: {
    pageSize: {
      getHeight: () => number;
      getWidth: () => number;
    };
  };
}

interface PdfPageBreaks {
  fallback: number[];
  preferred: number[];
}

// แบ่งหน้า PDF ตามขอบแถวจริงของตาราง แทนการตัดที่ความสูงหน้าคงที่ซึ่งจะผ่าแถวขาดกลาง
// preferred = จุดเริ่มกลุ่ม/บิล (ขึ้นหน้าใหม่พร้อมทั้งกลุ่ม), fallback = ขอบล่างของแต่ละแถว
export function addReportCanvasToPdfPages(
  pdf: PdfDocument,
  canvas: HTMLCanvasElement,
  sourceElement: HTMLElement,
  preferredBreakSelector = "tr.is-bill",
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageCanvasHeight = Math.floor((pageHeight / pageWidth) * canvas.width);
  const pageBreaks = getCanvasPageBreaks(
    sourceElement,
    canvas,
    preferredBreakSelector,
  );
  let pageStart = 0;
  let firstPage = true;

  while (pageStart < canvas.height) {
    const pageEnd = chooseReportPdfPageEnd(
      pageStart,
      Math.min(pageStart + pageCanvasHeight, canvas.height),
      canvas.height,
      pageBreaks,
    );
    const sliceHeight = Math.max(1, pageEnd - pageStart);
    const sliceCanvas = document.createElement("canvas");
    const context = sliceCanvas.getContext("2d");

    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;
    if (!context) break;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    context.drawImage(
      canvas,
      0,
      pageStart,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    if (!firstPage) pdf.addPage();
    pdf.addImage(
      sliceCanvas.toDataURL("image/png", 1),
      "PNG",
      0,
      0,
      pageWidth,
      (sliceHeight * pageWidth) / canvas.width,
    );

    firstPage = false;
    pageStart = pageEnd;
  }
}

export function chooseReportPdfPageEnd(
  pageStart: number,
  maxEnd: number,
  canvasHeight: number,
  pageBreaks: PdfPageBreaks,
) {
  if (maxEnd >= canvasHeight) return canvasHeight;

  const minUsefulHeight = pageStart + 120;
  const safeMaxEnd = maxEnd - 8;
  const preferredBoundary = pageBreaks.preferred
    .filter((value) => value > minUsefulHeight && value <= safeMaxEnd)
    .at(-1);
  const fallbackBoundary = pageBreaks.fallback
    .filter((value) => value > minUsefulHeight && value <= safeMaxEnd)
    .at(-1);

  return preferredBoundary ?? fallbackBoundary ?? maxEnd;
}

function getCanvasPageBreaks(
  sourceElement: HTMLElement,
  canvas: HTMLCanvasElement,
  preferredBreakSelector: string,
): PdfPageBreaks {
  const rootRect = sourceElement.getBoundingClientRect();
  const scaleY = canvas.height / sourceElement.scrollHeight;

  return {
    fallback: canvasPositions(
      sourceElement.querySelectorAll("tr"),
      rootRect.top,
      scaleY,
      canvas.height,
      "bottom",
    ),
    preferred: canvasPositions(
      sourceElement.querySelectorAll(preferredBreakSelector),
      rootRect.top,
      scaleY,
      canvas.height,
      "top",
    ),
  };
}

function canvasPositions(
  elements: NodeListOf<Element>,
  rootTop: number,
  scaleY: number,
  canvasHeight: number,
  edge: "bottom" | "top",
) {
  return Array.from(elements)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const y = edge === "top" ? rect.top : rect.bottom;
      return Math.round((y - rootTop) * scaleY);
    })
    .filter((value) => value > 0 && value < canvasHeight)
    .sort((left, right) => left - right);
}
