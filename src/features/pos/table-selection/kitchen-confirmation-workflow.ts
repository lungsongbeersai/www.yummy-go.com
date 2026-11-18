import type { PrintProgress } from "@/services/printer";

interface KitchenConfirmationWorkflow {
  confirmAndPrint: (closeLoading: () => void) => Promise<void>;
  closeLoading: () => void;
  onConfirmationError: (error: unknown) => void;
  onRefreshError: (error: unknown) => void;
  refresh: () => Promise<void>;
  release: () => void;
  isCurrent?: () => boolean;
}

export function createKitchenPrintProgressHandler({
  onProgress,
  onDeliveryComplete,
}: {
  onProgress: (progress: PrintProgress) => void;
  onDeliveryComplete?: () => void;
}) {
  let closed = false;
  return (progress: PrintProgress) => {
    if (closed) return;
    onProgress(progress);
    if (
      onDeliveryComplete &&
      progress.deliveryComplete === true &&
      progress.total > 0 &&
      progress.completed === progress.total &&
      progress.successCount === progress.total &&
      progress.failedCount === 0
    ) {
      closed = true;
      onDeliveryComplete();
    }
  };
}

export async function runKitchenConfirmation({
  confirmAndPrint,
  closeLoading,
  onConfirmationError,
  onRefreshError,
  refresh,
  release,
  isCurrent = () => true,
}: KitchenConfirmationWorkflow): Promise<void> {
  let loadingClosed = false;
  const closeLoadingOnce = () => {
    if (loadingClosed) return;
    loadingClosed = true;
    closeLoading();
  };
  try {
    try {
      await confirmAndPrint(closeLoadingOnce);
    } catch (error) {
      if (isCurrent()) onConfirmationError(error);
    } finally {
      closeLoadingOnce();
    }

    // Printing has settled, so the modal can close. Keep the submission and
    // draft-cleanup guards until the cart no longer contains the old draft.
    try {
      if (isCurrent()) await refresh();
    } catch (error) {
      if (isCurrent()) onRefreshError(error);
    }
  } finally {
    release();
  }
}
