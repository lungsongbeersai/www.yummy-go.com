import { describe, expect, it } from "vitest";
import enCommon from "../../public/locales/en/common.json";
import laCommon from "../../public/locales/la/common.json";

describe("shared translation resources", () => {
  it.each(["app", "auth", "packageManagement"] as const)(
    "keeps %s keys aligned between English and Lao",
    (namespace) => {
      expect(Object.keys(laCommon[namespace]).sort()).toEqual(
        Object.keys(enCommon[namespace]).sort(),
      );
    },
  );

  it("defines the login and language switch labels in both languages", () => {
    expect(enCommon.auth.noAccount).toBeTruthy();
    expect(enCommon.auth.register).toBeTruthy();
    expect(enCommon.app.changeLanguage).toBeTruthy();
    expect(enCommon.nav.package_management).toBeTruthy();
    expect(laCommon.auth.noAccount).toBeTruthy();
    expect(laCommon.auth.register).toBeTruthy();
    expect(laCommon.app.changeLanguage).toBeTruthy();
    expect(laCommon.nav.package_management).toBeTruthy();
  });

  it.each([
    "planDialogDescription",
    "packageDialogDescription",
    "packageDetailsDescription",
    "noMethodsAvailable",
    "discardTitle",
    "discardDescription",
    "discardAction",
    "removeDetail",
    "planSaveFailed",
  ] as const)("defines package form copy for %s in both languages", (key) => {
    expect(enCommon.packageManagement[key]).toBeTruthy();
    expect(laCommon.packageManagement[key]).toBeTruthy();
  });
});
