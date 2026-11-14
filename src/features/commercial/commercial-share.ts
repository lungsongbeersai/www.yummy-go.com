export interface CommercialShareNavigator {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}

export class CommercialShareUnavailableError extends Error {
  constructor() {
    super("This device cannot share PDF files directly.");
    this.name = "CommercialShareUnavailableError";
  }
}

export function isCommercialPdfFile(file: File | null): file is File {
  return file !== null && file.size > 0 && file.type.toLowerCase() === "application/pdf" && /\.pdf$/i.test(file.name);
}

export function canShareCommercialPdf(target: CommercialShareNavigator, file: File | null): boolean {
  if (!isCommercialPdfFile(file) || typeof target.share !== "function" || typeof target.canShare !== "function") return false;
  try {
    return target.canShare({ files: [file] }) === true;
  } catch {
    return false;
  }
}

/** Keep this synchronous so the native chooser receives the original click activation. */
export function shareCommercialPdf(target: CommercialShareNavigator, file: File, title: string): Promise<void> {
  if (!canShareCommercialPdf(target, file) || !target.share) throw new CommercialShareUnavailableError();
  return target.share({ files: [file], title });
}

export function isCommercialShareCancelled(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
