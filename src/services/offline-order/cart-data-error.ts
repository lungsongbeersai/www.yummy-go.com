import i18n from "@/lib/i18n";

export class OfflineCartDataUnavailableError extends Error {
  constructor() {
    super(i18n.t("offlineSync.mobileCartDataUnavailable"));
    this.name = "OfflineCartDataUnavailableError";
  }
}
