import { describe, expect, it } from "vitest";
import { batteryEstimate, wheelStatus, dateLevel, estimateService, tiresEstimate, getVehicleAlerts, serviceLevel, type AlertVehicle } from "./alerts";
import { addMonths, daysBetween, formatDate, formatPlate, maskDate, parseDMY, todayInIsrael } from "./format";

const today = "2026-11-14";
// Vehicles without a service log always carry an (ok-level) estimate; most tests ignore it.
const noEstimate = (alerts: ReturnType<typeof getVehicleAlerts>) => alerts.filter((a) => !a.estimated);
const base: AlertVehicle = {
  license_due: null,
  insurance_due: null,
  mileage: 50000,
  mileage_updated_at: today,
  next_service_km: null,
  service_interval_km: 10000,
  created_at: "2026-06-01T10:00:00Z",
};

describe("dateLevel", () => {
  it("uses the agreed thresholds", () => {
    expect(dateLevel(-1)).toBe("overdue");
    expect(dateLevel(0)).toBe("urgent");
    expect(dateLevel(7)).toBe("urgent");
    expect(dateLevel(8)).toBe("soon");
    expect(dateLevel(30)).toBe("soon");
    expect(dateLevel(31)).toBe("ok");
  });
});

describe("test + license is one concept", () => {
  it("produces a single alert for license_due", () => {
    const alerts = noEstimate(getVehicleAlerts({ ...base, license_due: "2026-11-20" }, today));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "license", title: "טסט וחידוש רישיון", level: "urgent" });
  });
  it("keeps insurance separate", () => {
    const alerts = noEstimate(getVehicleAlerts({ ...base, license_due: "2026-11-20", insurance_due: "2026-11-20" }, today));
    expect(alerts.map((a) => a.kind).sort()).toEqual(["insurance", "license"]);
  });
});

describe("service estimate (no history)", () => {
  it("uses the next multiple of the interval above the mileage", () => {
    const e = estimateService({ mileage: 54321, service_interval_km: 10000, created_at: "2026-06-01T10:00:00Z" }, today);
    expect(e.nextKm).toBe(60000);
    expect(e.kmLeft).toBe(5679);
    expect(e.nextDate).toBe("2027-06-01");
  });
  it("respects a per-vehicle interval and exact multiples", () => {
    expect(estimateService({ mileage: 15000, service_interval_km: 15000, created_at: "2026-06-01T10:00:00Z" }, today).nextKm).toBe(30000);
    expect(estimateService({ mileage: 0, service_interval_km: 10000, created_at: "2026-06-01T10:00:00Z" }, today).nextKm).toBe(10000);
  });
  it("takes the worse of km and date", () => {
    // 9,950 km -> 50 km left -> urgent, even though the date is far away
    expect(estimateService({ mileage: 9950, service_interval_km: 10000, created_at: "2026-06-01T10:00:00Z" }, today).level).toBe("urgent");
    // plenty of km left, but added 13 months ago -> overdue by date
    expect(estimateService({ mileage: 1000, service_interval_km: 10000, created_at: "2025-09-01T10:00:00Z" }, today).level).toBe("overdue");
  });
  it("is flagged as an estimate and disappears once a real service exists", () => {
    const withEstimate = getVehicleAlerts({ ...base, mileage: 9950 }, today).find((a) => a.kind === "service");
    expect(withEstimate).toMatchObject({ estimated: true, level: "urgent" });
    const real = getVehicleAlerts({ ...base, mileage: 9950, next_service_km: 20000 }, today).find((a) => a.kind === "service");
    expect(real?.estimated).toBeUndefined();
  });
});

describe("serviceLevel", () => {
  it("uses km thresholds", () => {
    expect(serviceLevel(0)).toBe("overdue");
    expect(serviceLevel(-50)).toBe("overdue");
    expect(serviceLevel(300)).toBe("urgent");
    expect(serviceLevel(301)).toBe("soon");
    expect(serviceLevel(1000)).toBe("soon");
    expect(serviceLevel(1001)).toBe("ok");
  });
});

describe("getVehicleAlerts", () => {
  it("returns nothing for a vehicle with no data and fresh mileage (estimate is far away)", () => {
    expect(getVehicleAlerts({ ...base, mileage: 50000 }, today).filter((a) => a.level !== "ok")).toEqual([]);
  });

  it("sorts overdue before urgent", () => {
    const alerts = noEstimate(getVehicleAlerts(
      {
        ...base,
        license_due: "2026-11-10", // -4 -> overdue
        insurance_due: "2026-11-18", // 4 -> urgent
      },
      today,
    ));
    expect(alerts.map((a) => a.level)).toEqual(["overdue", "urgent"]);
    expect(alerts.map((a) => a.kind)).toEqual(["license", "insurance"]);
  });

  it("flags service by km and stale mileage", () => {
    const alerts = getVehicleAlerts(
      { ...base, next_service_km: 50200, mileage_updated_at: "2026-08-01" },
      today,
    );
    expect(alerts.find((a) => a.kind === "service")?.level).toBe("urgent");
    expect(alerts.find((a) => a.kind === "mileage")?.level).toBe("soon");
  });

  it("does not flag mileage updated exactly 60 days ago", () => {
    const sixty = "2026-09-15";
    expect(daysBetween(sixty, today)).toBe(60);
    expect(noEstimate(getVehicleAlerts({ ...base, mileage_updated_at: sixty }, today))).toEqual([]);
  });
});

describe("format helpers", () => {
  it("formats and parses dates", () => {
    expect(formatDate("2026-03-05")).toBe("05/03/2026");
    expect(parseDMY("05/03/2026")).toBe("2026-03-05");
    expect(parseDMY("31/02/2026")).toBeNull();
    expect(parseDMY("5/3/26")).toBeNull();
    expect(maskDate("05032026")).toBe("05/03/2026");
    expect(maskDate("0503")).toBe("05/03");
  });
  it("formats Israeli plates", () => {
    expect(formatPlate("1234567")).toBe("12-345-67");
    expect(formatPlate("12345678")).toBe("123-45-678");
  });
  it("adds months without overflowing", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-14", 12)).toBe("2027-11-14");
  });
  it("resolves today in Asia/Jerusalem", () => {
    // 22:30 UTC on 14 Nov is already 00:30 on 15 Nov in Israel (UTC+2).
    expect(todayInIsrael(new Date("2026-11-14T22:30:00Z"))).toBe("2026-11-15");
    expect(todayInIsrael(new Date("2026-11-14T10:00:00Z"))).toBe("2026-11-14");
  });
});

describe("battery reminder", () => {
  it("is absent without a replacement date", () => {
    expect(getVehicleAlerts(base, today).some((a) => a.kind === "battery")).toBe(false);
    expect(batteryEstimate({ battery_replaced_at: null, battery_reminder_months: 36 }, today)).toBeNull();
  });
  it("defaults to 36 months and is labeled as an estimate", () => {
    const e = batteryEstimate({ battery_replaced_at: "2023-12-01" }, today)!;
    expect(e.dueDate).toBe("2026-12-01");
    expect(e.level).toBe("soon"); // 17 days
    const alert = getVehicleAlerts({ ...base, battery_replaced_at: "2023-12-01" }, today).find((a) => a.kind === "battery")!;
    expect(alert.estimated).toBe(true);
    expect(alert.title).toContain("הערכה");
  });
  it("honors a custom interval", () => {
    expect(batteryEstimate({ battery_replaced_at: "2026-01-15", battery_reminder_months: 6 }, today)!.level).toBe("overdue");
  });
});

describe("tires reminder", () => {
  const tires = { mileage: 90000, tires_reminder_months: 48, tires_reminder_km: 50000 };
  it("is absent without any date", () => {
    expect(tiresEstimate({ ...tires, tires_replaced_at: null, tires_separate: false, tire_fl_at: null, tire_fr_at: null, tire_rl_at: null, tire_rr_at: null, tires_replaced_km: null }, today)).toBeNull();
  });
  it("by months only when no km is recorded", () => {
    const e = tiresEstimate({ ...tires, tires_replaced_at: "2022-12-01", tires_replaced_km: null }, today)!;
    expect(e.dueDate).toBe("2026-12-01");
    expect(e.kmLeft).toBeNull();
    expect(e.level).toBe("soon");
  });
  it("km can fire before the date (whichever comes first)", () => {
    const e = tiresEstimate({ ...tires, tires_replaced_at: "2026-06-01", tires_replaced_km: 40500 }, today)!;
    expect(e.dueKm).toBe(90500);
    expect(e.kmLeft).toBe(500);
    expect(e.level).toBe("soon"); // 500 km left, date is far away
  });
  it("separate wheels use the oldest date", () => {
    const e = tiresEstimate(
      { ...tires, tires_separate: true, tires_replaced_at: "2026-01-01", tire_fl_at: "2026-05-01", tire_fr_at: "2026-05-01", tire_rl_at: "2022-10-01", tire_rr_at: null, tires_replaced_km: null },
      today,
    )!;
    expect(e.oldestDate).toBe("2022-10-01");
    expect(e.level).toBe("overdue");
  });
  it("ignores the single date when wheels are separate", () => {
    const e = tiresEstimate({ ...tires, tires_separate: true, tires_replaced_at: "2020-01-01", tire_fl_at: "2026-10-01", tire_fr_at: null, tire_rl_at: null, tire_rr_at: null, tires_replaced_km: null }, today)!;
    expect(e.oldestDate).toBe("2026-10-01");
  });
});

describe("wheelStatus", () => {
  const v = { mileage: 90000, tires_replaced_km: null, tires_reminder_months: 48, tires_reminder_km: 50000 };
  it("is null without a date", () => {
    expect(wheelStatus(null, v, today)).toEqual({ level: null, dueDate: null });
  });
  it("uses the wheel's own date", () => {
    expect(wheelStatus("2026-01-01", v, today).level).toBe("ok");
    expect(wheelStatus("2022-12-01", v, today).level).toBe("soon");
    expect(wheelStatus("2022-01-01", v, today).level).toBe("overdue");
  });
  it("takes the worse of date and km", () => {
    expect(wheelStatus("2026-06-01", { ...v, tires_replaced_km: 40500 }, today).level).toBe("soon");
    expect(wheelStatus("2026-06-01", { ...v, tires_replaced_km: 30000 }, today).level).toBe("overdue");
  });
});

describe("tires alert wording", () => {
  const v = { ...base, mileage: 90000, tires_reminder_months: 48, tires_reminder_km: 50000 };
  it("does not say 'whichever comes first' when only a date is known", () => {
    const a = getVehicleAlerts({ ...v, tires_replaced_at: "2022-12-15", tires_replaced_km: null }, today).find((x) => x.kind === "tires")!;
    expect(a.detail).not.toContain("המוקדם מביניהם");
  });
  it("says it when both a date and a km limit exist", () => {
    const a = getVehicleAlerts({ ...v, tires_replaced_at: "2022-12-15", tires_replaced_km: 60000 }, today).find((x) => x.kind === "tires")!;
    expect(a.detail).toContain("המוקדם מביניהם");
  });
});
