import { describe, expect, it } from "vitest";
import { batterySchema, emailSchema, garageSchema, mileageSchema, plateField, serviceLogSchema, tiresSchema, tokenSchema, vehicleSchema } from "./validation";

const vehicle = {
  nickname: "",
  plate: "123-45-678",
  make: "קיה",
  model: "נירו",
  year: "2022",
  color: "לבן",
  fuel_type: "hybrid",
  mileage: "50000",
  license_due: "31/12/2026",
  insurance_due: "",
  next_service_km: "",
  service_interval_km: "10000",
  last_service_date: "",
  last_service_km: "",
  notes: "",
  battery_replaced_at: "",
  battery_warranty_until: "",
  battery_notes: "",
  battery_reminder_months: "36",
  tires_separate: false,
  tires_replaced_at: "",
  tire_fl_at: "",
  tire_fr_at: "",
  tire_rl_at: "",
  tire_rr_at: "",
  tires_replaced_km: "",
  tires_reminder_months: "48",
  tires_reminder_km: "50000",
};

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) => (result.error?.issues ?? []).map((i) => String(i.path[0]));

describe("vehicleSchema", () => {
  it("accepts a complete vehicle and normalizes values", () => {
    const r = vehicleSchema.safeParse(vehicle);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.plate).toBe("12345678");
      expect(r.data.license_due).toBe("2026-12-31");
      expect(r.data.mileage).toBe(50000);
      expect(r.data.nickname).toBeNull();
      expect(r.data.battery_reminder_months).toBe(36);
    }
  });
  it("requires make, model and mileage", () => {
    const r = vehicleSchema.safeParse({ ...vehicle, make: " ", model: "", mileage: "" });
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toEqual(expect.arrayContaining(["make", "model", "mileage"]));
  });
  it("rejects a malformed plate and an impossible date", () => {
    expect(issuePaths(vehicleSchema.safeParse({ ...vehicle, plate: "12" }))).toContain("plate");
    expect(issuePaths(vehicleSchema.safeParse({ ...vehicle, license_due: "31/02/2026" }))).toContain("license_due");
  });
  it("needs last-service date and km together", () => {
    expect(issuePaths(vehicleSchema.safeParse({ ...vehicle, last_service_date: "01/01/2025" }))).toContain("last_service_km");
    expect(issuePaths(vehicleSchema.safeParse({ ...vehicle, last_service_km: "40000" }))).toContain("last_service_date");
    expect(vehicleSchema.safeParse({ ...vehicle, last_service_date: "01/01/2025", last_service_km: "40000" }).success).toBe(true);
  });
  it("rejects a last service above the current mileage", () => {
    expect(issuePaths(vehicleSchema.safeParse({ ...vehicle, last_service_date: "01/01/2025", last_service_km: "60000" }))).toContain("last_service_km");
  });
  it("keeps the service interval at 1,000 km or more", () => {
    expect(issuePaths(vehicleSchema.safeParse({ ...vehicle, service_interval_km: "500" }))).toContain("service_interval_km");
  });
  it("rejects tires replaced at a higher odometer than now", () => {
    expect(issuePaths(vehicleSchema.safeParse({ ...vehicle, tires_replaced_km: "60000" }))).toContain("tires_replaced_km");
  });
  it("stores only the active tire mode", () => {
    const single = vehicleSchema.parse({ ...vehicle, tires_replaced_at: "01/01/2024", tire_fl_at: "01/01/2023" });
    expect(single.tires_replaced_at).toBe("2024-01-01");
    expect(single.tire_fl_at).toBeNull();
    const separate = vehicleSchema.parse({ ...vehicle, tires_separate: true, tires_replaced_at: "01/01/2024", tire_fl_at: "01/01/2023" });
    expect(separate.tires_replaced_at).toBeNull();
    expect(separate.tire_fl_at).toBe("2023-01-01");
  });
});

describe("batterySchema", () => {
  const base = { battery_replaced_at: "", battery_warranty_until: "", battery_notes: "", battery_reminder_months: "36" };
  it("accepts empty optional fields", () => {
    const r = batterySchema.parse(base);
    expect(r.battery_replaced_at).toBeNull();
    expect(r.battery_reminder_months).toBe(36);
  });
  it("rejects a future replacement date but allows a future warranty", () => {
    expect(issuePaths(batterySchema.safeParse({ ...base, battery_replaced_at: "01/01/2999" }))).toContain("battery_replaced_at");
    expect(batterySchema.safeParse({ ...base, battery_warranty_until: "01/01/2999" }).success).toBe(true);
  });
  it("validates the reminder interval", () => {
    expect(issuePaths(batterySchema.safeParse({ ...base, battery_reminder_months: "0" }))).toContain("battery_reminder_months");
    expect(issuePaths(batterySchema.safeParse({ ...base, battery_reminder_months: "121" }))).toContain("battery_reminder_months");
    expect(issuePaths(batterySchema.safeParse({ ...base, battery_reminder_months: "" }))).toContain("battery_reminder_months");
  });
});

describe("tiresSchema", () => {
  const base = {
    tires_separate: false,
    tires_replaced_at: "01/01/2024",
    tire_fl_at: "",
    tire_fr_at: "",
    tire_rl_at: "",
    tire_rr_at: "",
    tires_replaced_km: "",
    tires_reminder_months: "48",
    tires_reminder_km: "50000",
  };
  it("accepts the defaults", () => {
    expect(tiresSchema.safeParse(base).success).toBe(true);
  });
  it("validates reminder limits", () => {
    expect(issuePaths(tiresSchema.safeParse({ ...base, tires_reminder_km: "500" }))).toContain("tires_reminder_km");
    expect(issuePaths(tiresSchema.safeParse({ ...base, tires_reminder_months: "0" }))).toContain("tires_reminder_months");
  });
  it("clears wheel dates in single mode and the single date in separate mode", () => {
    const single = tiresSchema.parse({ ...base, tire_fr_at: "01/01/2023" });
    expect(single.tire_fr_at).toBeNull();
    const separate = tiresSchema.parse({ ...base, tires_separate: true, tire_fr_at: "01/01/2023" });
    expect(separate.tires_replaced_at).toBeNull();
    expect(separate.tire_fr_at).toBe("2023-01-01");
  });
  it("rejects future wheel dates", () => {
    expect(issuePaths(tiresSchema.safeParse({ ...base, tires_separate: true, tire_rl_at: "01/01/2999" }))).toContain("tire_rl_at");
  });
});

describe("garageSchema", () => {
  it("requires a name and trims it", () => {
    expect(issuePaths(garageSchema.safeParse({ name: "  ", phone: "", address: "", notes: "" }))).toContain("name");
    expect(garageSchema.parse({ name: "  מוסך משה ", phone: "", address: "", notes: "" }).name).toBe("מוסך משה");
  });
  it("accepts formatted phones and rejects junk", () => {
    expect(garageSchema.parse({ name: "מ", phone: "03-123 4567", address: "", notes: "" }).phone).toBe("03-123 4567");
    expect(garageSchema.parse({ name: "מ", phone: "", address: "", notes: "" }).phone).toBeNull();
    expect(issuePaths(garageSchema.safeParse({ name: "מ", phone: "abc", address: "", notes: "" }))).toContain("phone");
  });
});

describe("serviceLogSchema", () => {
  const log = { service_date: "01/11/2026", mileage: "55000", garage: "", garage_id: "", cost: "450,50", notes: "" };
  it("parses cost with a comma and an empty garage link", () => {
    const r = serviceLogSchema.parse(log);
    expect(r.cost).toBe(450.5);
    expect(r.garage_id).toBeNull();
    expect(r.garage).toBeNull();
  });
  it("accepts a uuid garage and rejects anything else", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(serviceLogSchema.parse({ ...log, garage_id: id }).garage_id).toBe(id);
    expect(issuePaths(serviceLogSchema.safeParse({ ...log, garage_id: "nope" }))).toContain("garage_id");
  });
  it("rejects a future service date and a bad cost", () => {
    expect(issuePaths(serviceLogSchema.safeParse({ ...log, service_date: "01/01/2999" }))).toContain("service_date");
    expect(issuePaths(serviceLogSchema.safeParse({ ...log, cost: "12.345" }))).toContain("cost");
  });
});

describe("small fields", () => {
  it("normalizes plates to digits", () => {
    expect(plateField.parse("12-345-67")).toBe("1234567");
    expect(plateField.safeParse("123456").success).toBe(false);
  });
  it("normalizes and validates emails", () => {
    expect(emailSchema.parse(" A@X.com ")).toBe("a@x.com");
    expect(emailSchema.safeParse("a@b").success).toBe(false);
  });
  it("validates invite tokens", () => {
    expect(tokenSchema.safeParse("abcdefabcdefabcdef12").success).toBe(true);
    expect(tokenSchema.safeParse("short").success).toBe(false);
    expect(tokenSchema.safeParse("has space in token!!").success).toBe(false);
  });
  it("validates the mileage update", () => {
    expect(mileageSchema.parse({ mileage: "123" }).mileage).toBe(123);
    expect(mileageSchema.safeParse({ mileage: "12a" }).success).toBe(false);
  });
});
