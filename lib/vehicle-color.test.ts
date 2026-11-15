import { describe, expect, it, vi } from "vitest";
import { colorTint, NEUTRAL_HEX } from "./vehicle-color";

// Real tzeva_rechev values from data.gov.il (a 300,000-row sample of the vehicle dataset, most common first).
// [ministry text, expected base color, expected shade]. "?" = not a known color (neutral gray).
type Shade = "" | "dark" | "light";
const REAL: [string, string, Shade][] = [
  ["שנהב לבן", "לבן", ""], ["כסף מטלי", "כסף", ""], ["שחור", "שחור", ""], ["כסף", "כסף", ""], ["שחור מטלי", "שחור", ""],
  ["אפור", "אפור", ""], ["אפור מטל", "אפור", ""], ["אפור כהה", "אפור", "dark"], ["אפור כהה מטלי", "אפור", "dark"],
  ["כחול", "כחול", ""], ["כחול מטל", "כחול", ""], ["תכלת מטאלי", "תכלת", ""], ["אדום", "אדום", ""],
  ["כסוף כהה", "כסף", "dark"], ["בז", "בז", ""], ["אפור בהיר מטלי", "אפור", "light"], ["לא ידוע", "?", ""],
  ["בז מטאלי", "בז", ""], ["כסוף כהה מטלי", "כסף", "dark"], ["אפור פלדה", "אפור", ""], ["אדום מטל", "אדום", ""],
  ["אפור בהיר", "אפור", "light"], ["כחול כהה", "כחול", "dark"], ["ברונזה", "חום", ""], ["קרם", "בז", ""],
  ["קפה מטאלי", "חום", ""], ["תכלת", "תכלת", ""], ["שחור פנינה", "שחור", ""], ["כסוף בהיר", "כסף", "light"],
  ["כחול בהיר", "כחול", "light"], ["כתום", "כתום", ""], ["ירוק", "ירוק", ""], ["שן פיל", "בז", ""],
  ["אפור כחול מטלי", "אפור", ""], ["כחול פנינה", "כחול", ""], ["ירוק מטל", "ירוק", ""], ["אפור ברונזה", "אפור", ""],
  ["זהב", "זהב", ""], ["כסף תכלת מטלי", "כסף", ""], ["ירוק בהיר", "ירוק", "light"], ["חום", "חום", ""],
  ["צהוב", "צהוב", ""], ["אדום כהה (יין)", "אדום", "dark"], ["בורדו", "בורדו", ""], ["פלטינה", "כסף", ""],
  ["טורקיז מטאלי", "טורקיז", ""], ["רב גווני", "?", ""], ["זהב מטאלי", "זהב", ""], ["חום בהיר", "חום", "light"],
  ["טורקיז", "טורקיז", ""], ["בורדו מטל", "בורדו", ""], ["ירוק כהה", "ירוק", "dark"], ["ירקרק בהיר", "ירוק", "light"],
  ["סגול", "סגול", ""], ["כסף כחלחל מטלי", "כסף", ""], ["כחול פחם מטלי", "כחול", ""], ["זהוב", "זהב", ""],
  ["כסוף מילניום", "כסף", ""], ["ורוד", "ורוד", ""], ["חציל", "סגול", ""], ["חום כהה", "חום", "dark"],
  ["ירוק זית מטלי", "ירוק", ""], ["כחול קריסטל", "כחול", ""], ["כסף ים", "כסף", ""], ["אדום קלאסי", "אדום", ""],
  ["צהוב מטאלי", "צהוב", ""], ["נחושת", "כתום", ""], ["ירוק זית", "ירוק", ""], ["נחושת מטאלי", "כתום", ""],
  ["סגול כהה", "סגול", "dark"], ["ירוק כסוף", "ירוק", ""], ["זית מטאלי", "ירוק", ""], ["סהרה", "?", ""],
  ["ירוק אקווה", "ירוק", ""], ["ירקרק", "ירוק", ""], ["טוניק", "?", ""], ["ירקרק מטלי", "ירוק", ""],
  ["אדום זוהר", "אדום", ""], ["סגול בהיר", "סגול", "light"], ["אדום שחור", "אדום", ""], ["ירוק ים", "ירוק", ""],
  ["צהוב לימון", "צהוב", ""], ["טורקיז כהה", "טורקיז", "dark"], ["רוז מתכתי", "ורוד", ""], ["אדום בהיר", "אדום", "light"],
  ["כסף ירקרק", "כסף", ""], ["ירוק פנינה", "ירוק", ""], ["בז כהה", "בז", "dark"], ["שחור חציל", "שחור", ""],
  ["ירוק טורקיז", "ירוק", ""], ["ירוק זהב מטלי", "ירוק", ""], ["מנדרינה מט", "כתום", ""], ["מלאנג מטאלי", "?", ""],
  ["טורקיז בהיר מטאלי", "טורקיז", "light"], ["אחר", "?", ""], ["אדמדם מטאלי", "אדום", ""], ["צהוב חזק", "צהוב", ""],
  ["חרדל", "צהוב", ""],
];

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

describe("colorTint with real ministry values", () => {
  it.each(REAL)("%s -> %s %s", (text, base, shade) => {
    const t = colorTint(text);
    if (base === "?") {
      expect(t.known).toBe(false);
      expect(t.hex).toBe(NEUTRAL_HEX);
      return;
    }
    expect(t.known).toBe(true);
    const ref = colorTint(shade === "dark" ? `${base} כהה` : shade === "light" ? `${base} בהיר` : base);
    expect(t.hex).toBe(ref.hex);
  });

  it("has known tints for known-answer anchors", () => {
    expect(colorTint("שנהב לבן").hex).toBe("#f8fafc");
    expect(colorTint("שחור מטלי").hex).toBe("#1f2937");
    expect(colorTint("אדום").hex).toBe("#ef4444");
  });
});

describe("shades and normalization", () => {
  it("makes dark darker and light lighter than the base", () => {
    for (const b of ["אפור", "כחול", "כסף", "ירוק", "אדום"]) {
      expect(lum(colorTint(`${b} כהה`).hex)).toBeLessThan(lum(colorTint(b).hex));
      expect(lum(colorTint(`${b} בהיר`).hex)).toBeGreaterThan(lum(colorTint(b).hex));
    }
    expect(colorTint("אפור כהה").hex).not.toBe(colorTint("אפור בהיר").hex);
  });

  it("ignores finish words, spacing and order of modifiers", () => {
    expect(colorTint("  אפור   כהה  מטאלי ").hex).toBe(colorTint("אפור כהה").hex);
    expect(colorTint("אפור כהה מטלי").hex).toBe(colorTint("אפור כהה פנינה").hex);
    expect(colorTint("אפור מבריק").hex).toBe(colorTint("אפור").hex);
    expect(colorTint("כסוף").hex).toBe(colorTint("כסף").hex);
    expect(colorTint("בז׳").hex).toBe(colorTint("בז").hex);
  });

  it("uses the first color word for combinations", () => {
    expect(colorTint("אדום שחור").hex).toBe(colorTint("אדום").hex);
    expect(colorTint("כחול פחם").hex).toBe(colorTint("כחול").hex);
    expect(colorTint("לבן שנהב").hex).toBe(colorTint("לבן").hex);
  });

  it("tells light blue, beige and pink apart from their neighbors", () => {
    expect(colorTint("תכלת").hex).not.toBe(colorTint("כחול").hex);
    expect(colorTint("בז").hex).not.toBe(colorTint("חום").hex);
    expect(colorTint("ורוד").hex).not.toBe(colorTint("אדום").hex);
  });

  it("falls back to neutral gray for empty and unknown values", () => {
    for (const v of [null, undefined, "", "   ", "משהו לא מוכר"]) {
      const t = colorTint(v);
      expect(t.hex).toBe(NEUTRAL_HEX);
      expect(t.known).toBe(false);
    }
  });

  it("gives light colors a darker, heavier-looking outline for visibility on white", () => {
    for (const v of ["שנהב לבן", "לבן", "כסף", "בז"]) {
      const t = colorTint(v);
      expect(t.light).toBe(true);
      expect(t.outline).toBe("#6b7280");
    }
    expect(colorTint("שחור").light).toBe(false);
  });

  it("legacy normalized names still work", () => {
    expect(colorTint("כסוף").known).toBe(true);
    expect(colorTint("אחר").known).toBe(false);
  });
});

describe("dev logging", () => {
  it("warns once for an unknown color in development only", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    colorTint("צבע חדש לגמרי");
    colorTint("צבע חדש לגמרי");
    expect(warn).toHaveBeenCalledTimes(1);
    vi.stubEnv("NODE_ENV", "test");
    colorTint("עוד צבע חדש");
    expect(warn).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
    warn.mockRestore();
  });
});
