import { describe, expect, it } from "vitest";
import { dateLevel, getVehicleAlerts, serviceLevel, type AlertVehicle } from "./alerts";
import { addMonths, daysBetween, formatDate, formatPlate, maskDate, parseDMY, todayInIsrael } from "./format";

const today = "2026-11-14";
const base: AlertVehicle = {
  test_due: null,
  license_due: null,
  insurance_due: null,
  mileage: 50000,
  mileage_updated_at: today,
  next_service_km: null,
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
  it("returns nothing for a vehicle with no data and fresh mileage", () => {
    expect(getVehicleAlerts(base, today)).toEqual([]);
  });

  it("sorts overdue before urgent before soon", () => {
    const alerts = getVehicleAlerts(
      {
        ...base,
        test_due: "2026-12-01", // 17 days -> soon
        license_due: "2026-11-10", // -4 -> overdue
        insurance_due: "2026-11-18", // 4 -> urgent
      },
      today,
    );
    expect(alerts.map((a) => a.level)).toEqual(["overdue", "urgent", "soon"]);
    expect(alerts.map((a) => a.kind)).toEqual(["license", "insurance", "test"]);
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
    expect(getVehicleAlerts({ ...base, mileage_updated_at: sixty }, today)).toEqual([]);
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
