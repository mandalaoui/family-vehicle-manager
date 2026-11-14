import { describe, expect, it } from "vitest";
import { addDays, daysBetween, digitsOnly, formatDays, formatNumber, formatPlate, plural, todayInIsrael } from "./format";

describe("format helpers", () => {
  it("formats numbers with thousands separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
  it("keeps digits only", () => {
    expect(digitsOnly("12-345 67ab")).toBe("1234567");
  });
  it("formats 7 and 8 digit plates the Israeli way", () => {
    expect(formatPlate("1234567")).toBe("12-345-67");
    expect(formatPlate("12345678")).toBe("123-45-678");
  });
  it("pluralizes Hebrew nouns", () => {
    expect(plural(1, "רכב", "רכבים")).toBe("רכב");
    expect(plural(2, "רכב", "רכבים")).toBe("רכבים");
    expect(plural(0, "רכב", "רכבים")).toBe("רכבים");
  });
  it("counts days across month and year boundaries", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-03-01", "2026-02-01")).toBe(-28);
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });
  it("describes durations in days", () => {
    expect(formatDays(1)).toBeTruthy();
    expect(formatDays(5)).toContain("5");
  });
  it("computes today in Israel, not UTC", () => {
    // 22:30 UTC on 14 Nov is already 00:30 on 15 Nov in Israel (UTC+2 in winter).
    expect(todayInIsrael(new Date("2026-11-14T22:30:00Z"))).toBe("2026-11-15");
    expect(todayInIsrael(new Date("2026-11-14T10:00:00Z"))).toBe("2026-11-14");
  });
});
