import { describe, expect, it } from "vitest";
import { employeeWorkBoundaryDelay, employeeWorkClock, employeeWorkPeriod } from "./employee-work-period";

describe("employee work 05:00 Vientiane period", () => {
  it.each([
    ["2026-11-15T04:59:59.999+07:00", "2026-11-14", "2026-11-13T22:00:00.000Z", "2026-11-14T22:00:00.000Z"],
    ["2026-11-15T05:00:00+07:00", "2026-11-15", "2026-11-14T22:00:00.000Z", "2026-11-15T22:00:00.000Z"],
    ["2026-11-16T00:00:00+07:00", "2026-11-15", "2026-11-14T22:00:00.000Z", "2026-11-15T22:00:00.000Z"],
    ["2026-12-01T04:59:59.999+07:00", "2026-11-30", "2026-11-29T22:00:00.000Z", "2026-11-30T22:00:00.000Z"],
    ["2027-01-01T04:59:59.999+07:00", "2026-12-31", "2026-12-30T22:00:00.000Z", "2026-12-31T22:00:00.000Z"],
    ["2027-01-01T05:00:00+07:00", "2027-01-01", "2026-12-31T22:00:00.000Z", "2027-01-01T22:00:00.000Z"],
    ["2028-02-29T05:00:00+07:00", "2028-02-29", "2028-02-28T22:00:00.000Z", "2028-02-29T22:00:00.000Z"],
    ["2028-03-01T04:59:59.999+07:00", "2028-02-29", "2028-02-28T22:00:00.000Z", "2028-02-29T22:00:00.000Z"],
    ["2028-03-01T05:00:00+07:00", "2028-03-01", "2028-02-29T22:00:00.000Z", "2028-03-01T22:00:00.000Z"],
  ])("places %s inside the exact half-open business day", (value, businessDay, startsAt, endsAt) => {
    const now = new Date(value);
    const period = employeeWorkPeriod(now);
    expect(period).toEqual({ businessDay, startsAt, endsAt, nextBoundaryAt: endsAt });
    expect(now.getTime()).toBeGreaterThanOrEqual(Date.parse(period.startsAt));
    expect(now.getTime()).toBeLessThan(Date.parse(period.endsAt));
  });

  it("keeps the same period across UTC and western device timezones including DST", () => {
    const original = process.env.TZ;
    try {
      const expected = {
        businessDay: "2026-03-08", startsAt: "2026-03-07T22:00:00.000Z",
        endsAt: "2026-03-08T22:00:00.000Z", nextBoundaryAt: "2026-03-08T22:00:00.000Z",
      };
      for (const zone of ["UTC", "Asia/Vientiane", "America/New_York", "Pacific/Honolulu"]) {
        process.env.TZ = zone;
        expect(employeeWorkPeriod(new Date("2026-03-08T08:00:00Z"))).toEqual(expected);
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("rejects an invalid clock rather than fabricating a business day", () => {
    expect(() => employeeWorkPeriod(new Date(NaN))).toThrow(RangeError);
  });
});

describe("employee work sampled server clock", () => {
  const serverNow = "2026-11-15T04:59:58+07:00";
  const receivedAtMs = Date.parse("2030-01-01T00:00:00Z");

  it("uses the server instant even when the device clock is years ahead", () => {
    expect(employeeWorkClock(serverNow, receivedAtMs, receivedAtMs).toISOString()).toBe("2026-11-14T21:59:58.000Z");
    expect(employeeWorkClock(serverNow, receivedAtMs, receivedAtMs + 2_000).toISOString()).toBe("2026-11-14T22:00:00.000Z");
    expect(employeeWorkPeriod(employeeWorkClock(serverNow, receivedAtMs, receivedAtMs + 2_000)).businessDay).toBe("2026-11-15");
  });

  it("does not rewind the sampled server time when the device clock moves backwards", () => {
    expect(employeeWorkClock(serverNow, receivedAtMs, receivedAtMs - 60_000).toISOString()).toBe("2026-11-14T21:59:58.000Z");
  });

  it("schedules the exact boundary and bounds expired or far-future timeouts", () => {
    const boundary = "2026-11-15T05:00:00+07:00";
    expect(employeeWorkBoundaryDelay(boundary, serverNow, receivedAtMs, receivedAtMs)).toBe(2_000);
    expect(employeeWorkBoundaryDelay(boundary, serverNow, receivedAtMs, receivedAtMs + 1_999)).toBe(1);
    expect(employeeWorkBoundaryDelay(boundary, serverNow, receivedAtMs, receivedAtMs + 2_000)).toBe(1);
    expect(employeeWorkBoundaryDelay(boundary, serverNow, receivedAtMs, receivedAtMs + 60_000)).toBe(1);
    expect(employeeWorkBoundaryDelay("2036-01-01T00:00:00Z", serverNow, receivedAtMs, receivedAtMs)).toBe(2_147_483_647);
  });

  it("accepts explicit ISO UTC instants and rejects zone-less server values", () => {
    expect(employeeWorkClock("2026-11-14T21:59:58Z", receivedAtMs, receivedAtMs).toISOString()).toBe("2026-11-14T21:59:58.000Z");
    for (const value of ["", "bad", "2026-11-15 04:59:58", "2026-11-15T04:59:58"]) {
      expect(() => employeeWorkClock(value, receivedAtMs, receivedAtMs)).toThrow(RangeError);
      expect(() => employeeWorkBoundaryDelay(value, serverNow, receivedAtMs, receivedAtMs)).toThrow(RangeError);
    }
    expect(() => employeeWorkClock(serverNow, NaN, receivedAtMs)).toThrow(RangeError);
    expect(() => employeeWorkClock(serverNow, receivedAtMs, Infinity)).toThrow(RangeError);
  });
});
