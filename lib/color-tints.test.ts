import { describe, expect, it } from "vitest";
import { COLORS, COLOR_HEX } from "./format";
import { mapColor } from "./ministry-map";

// raw ministry text -> [stored color name, illustration tint]
const CASES: [string, string, string][] = [
  ["כסף", "כסוף", "#cbd5e1"],
  ["כסוף", "כסוף", "#cbd5e1"],
  ["כסוף כהה", "כסוף", "#cbd5e1"],
  ["כסף מטלי", "כסוף", "#cbd5e1"],
  ["אפור כהה", "אפור", "#94a3b8"],
  ["אפור מטלי", "אפור", "#94a3b8"],
  ["לבן פנינה", "לבן", "#f8fafc"],
  ["כחול כהה", "כחול", "#3b82f6"],
  ["תכלת", "תכלת", "#7dd3fc"],
  ["ורוד", "ורוד", "#f9a8d4"],
  ["בורדו", "בורדו", "#9f1239"],
  ["בז'", "בז'", "#e7d8b8"],
  ["בז׳ מטלי", "בז'", "#e7d8b8"],
  ["אדום בורדו", "אדום", "#ef4444"],
  ["ירוק זית", "ירוק", "#22c55e"],
  ["טורקיז", "טורקיז", "#14b8a6"],
  ["קרם", "קרם", "#fff0b8"],
  ["שן פיל", "שן פיל", "#f1ebdc"],
  ["שן  פיל מטלי", "שן פיל", "#f1ebdc"],
  ["ססגוני", "אחר", "#a8a29e"],
];

describe("mapColor + COLOR_HEX", () => {
  it.each(CASES)("%s -> %s", (raw, name, hex) => {
    expect(mapColor(raw)).toBe(name);
    expect(COLOR_HEX[name]).toBe(hex);
  });

  it("the first color word decides", () => {
    expect(mapColor("אדום שחור")).toBe("אדום");
    expect(mapColor("שחור אדום")).toBe("שחור");
    expect(mapColor("כחול פחם")).toBe("כחול");
    expect(mapColor("מטלי כהה כסוף")).toBe("כסוף");
    expect(mapColor("בורדו אדום")).toBe("בורדו");
  });

  it("returns null for empty input and אחר for unknown text", () => {
    expect(mapColor(null)).toBeNull();
    expect(mapColor("  ")).toBeNull();
    expect(mapColor("כהה מטלי")).toBe("אחר");
  });

  it("every selectable color has a tint, and a distinct one", () => {
    for (const c of COLORS) expect(COLOR_HEX[c], c).toMatch(/^#[0-9a-f]{6}$/);
    const hexes = COLORS.map((c) => COLOR_HEX[c]);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it("every canonical name produced by mapColor is selectable", () => {
    for (const [raw] of CASES) expect(COLORS as readonly string[]).toContain(mapColor(raw));
  });
});

// The car is drawn on bg-silver-100 (#e8eaed) with a #374151 outline (VehicleImage). A light body (white,
// cream, ivory) only stays visible because of that outline, so it must keep non-text contrast >= 3:1.
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("light cars on the light card", () => {
  it("the outline separates every tint from the card", () => {
    expect(contrast("#374151", "#e8eaed")).toBeGreaterThanOrEqual(3);
  });
  it("the outline is also visible against the lightest bodies", () => {
    for (const c of ["לבן", "קרם", "שן פיל"]) expect(contrast("#374151", COLOR_HEX[c])).toBeGreaterThanOrEqual(3);
  });
});
