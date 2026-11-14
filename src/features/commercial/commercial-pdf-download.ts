"use client";

export interface CommercialPdfDownload {
  dispose: () => void;
  released: Promise<void>;
}

/** Start within the current task, so a later session cannot inherit a queued click. */
export function downloadCommercialPdfFile(file: File, isCurrent: () => boolean = () => true): CommercialPdfDownload {
  if (!isCurrent()) throw new DOMException("Document export cancelled", "AbortError");
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let release: () => void = () => {};
  const released = new Promise<void>(resolve => { release = resolve; });
  let active = true;
  const dispose = () => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    URL.revokeObjectURL(url);
    release();
  };
  try {
    document.body.append(link);
    if (!isCurrent()) throw new DOMException("Document export cancelled", "AbortError");
    link.click();
    timer = setTimeout(dispose, 1000);
    return { dispose, released };
  } catch (error) {
    dispose();
    throw error;
  } finally { link.remove(); }
}
