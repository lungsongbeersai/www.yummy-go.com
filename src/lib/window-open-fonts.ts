export const WINDOW_OPEN_FONT_CLASS_NAME = "window-open-fonts";
export const WINDOW_OPEN_FONT_QUERY_PARAM = "window_open_fonts";
export const WINDOW_OPEN_FONT_STYLESHEET_HREF = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/window-open-fonts.css`;
export const WINDOW_OPEN_FONT_STYLESHEET_LINK = `<link rel="stylesheet" href="${WINDOW_OPEN_FONT_STYLESHEET_HREF}" />`;

export const WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT = `
  window.addEventListener("load", () => {
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    Promise.resolve(fontsReady).finally(() => {
      window.focus();
      window.setTimeout(() => window.print(), 250);
    });
  });`;

export function withWindowOpenFonts(
  value: string,
  currentOrigin: string,
  additionalOrigins: string[] = [],
) {
  try {
    const url = new URL(value, currentOrigin);
    if (![currentOrigin, ...additionalOrigins].includes(url.origin)) return value;
    url.searchParams.set(WINDOW_OPEN_FONT_QUERY_PARAM, "1");
    return url.toString();
  } catch {
    return value;
  }
}
