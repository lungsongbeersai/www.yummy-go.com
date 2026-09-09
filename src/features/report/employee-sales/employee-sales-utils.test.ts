import { describe, expect, it } from "vitest";
import { activeEmployeeSalesFilterCount } from "./employee-sales-utils";

describe("employee sales presentation", () => {
  it("counts only non-default filters, not the always-required branch/date fields", () => {
    const today = "2026-09-09";
    expect(activeEmployeeSalesFilterCount({ dateFrom: today, dateTo: today, loginUuid: "" }, today)).toBe(0);
    expect(activeEmployeeSalesFilterCount({ dateFrom: "2026-09-01", dateTo: today, loginUuid: "" }, today)).toBe(1);
    expect(activeEmployeeSalesFilterCount({ dateFrom: today, dateTo: today, loginUuid: "fc445438-e617-471c-9af3-262ae747932f" }, today)).toBe(1);
    expect(activeEmployeeSalesFilterCount({ dateFrom: "2026-09-01", dateTo: "2026-09-05", loginUuid: "fc445438-e617-471c-9af3-262ae747932f" }, today)).toBe(2);
  });
});
