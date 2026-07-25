// Lets a print/export target finish its layout paint before capture (e.g. html2canvas) runs.
export function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
