interface KitchenConfirmationWorkflow {
  confirmAndPrint: () => Promise<void>;
  closeLoading: () => void;
  onConfirmationError: (error: unknown) => void;
  onRefreshError: (error: unknown) => void;
  refresh: () => Promise<void>;
  release: () => void;
}

export async function runKitchenConfirmation({
  confirmAndPrint,
  closeLoading,
  onConfirmationError,
  onRefreshError,
  refresh,
  release,
}: KitchenConfirmationWorkflow): Promise<void> {
  try {
    try {
      await confirmAndPrint();
    } catch (error) {
      onConfirmationError(error);
    } finally {
      closeLoading();
    }

    // Printing has settled, so the modal can close. Keep the submission and
    // draft-cleanup guards until the cart no longer contains the old draft.
    try {
      await refresh();
    } catch (error) {
      onRefreshError(error);
    }
  } finally {
    release();
  }
}
