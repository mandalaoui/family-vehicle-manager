// Maps a free-text vehicle color (as the ministry writes it, e.g. "אפור כהה מטלי") to a tint for the car
// illustration. Only the tint is normalized: the stored/displayed text stays exactly as entered.

export type ColorTint = {
  /** Fill color for the illustration. */
  hex: string;
  /** Stroke color for the outline. Darker and heavier for light fills so they stay visible on a light background. */
  outline: string;
  light: boolean;
  /** false when the text could not be matched (neutral gray is used). */
  known: boolean;
};

export const NEUTRAL_HEX = "#a8a29e";

// Base color words (after normalization) and their mid-tone hex. Order is irrelevant: the FIRST matching
// word in the text decides, so "אדום שחור" is red and "כחול פחם" is blue.
const BASE_HEX: Record<string, string> = {
  לבן: "#f8fafc",
  שחור: "#1f2937",
  אפור: "#9ca3af",
  כסף: "#cbd5e1",
  כחול: "#3b82f6",
  תכלת: "#7dd3fc",
  אדום: "#ef4444",
  בורדו: "#9f1239",
  ירוק: "#22c55e",
  צהוב: "#facc15",
  כתום: "#f97316",
  חום: "#92400e",
  בז: "#e7d8b8",
  זהב: "#d4a72c",
  סגול: "#8b5cf6",
  ורוד: "#f9a8d4",
  טורקיז: "#14b8a6",
};

// Synonyms and derived forms -> base word.
const ALIASES: Record<string, string> = {
  שנהב: "לבן",
  כסוף: "כסף",
  פלטינה: "כסף",
  טיטניום: "אפור",
  גרפיט: "אפור",
  פחם: "אפור",
  נייבי: "כחול",
  כחלחל: "כחול",
  אדמדם: "אדום",
  יין: "בורדו",
  ירקרק: "ירוק",
  זית: "ירוק",
  חרדל: "צהוב",
  קפה: "חום",
  שוקולד: "חום",
  ברונזה: "חום",
  נחושת: "כתום",
  מנדרינה: "כתום",
  זהוב: "זהב",
  שמפניה: "זהב",
  קרם: "בז",
  רוז: "ורוד",
  חציל: "סגול",
};

// Words that describe the finish, not the color.
const IGNORED = new Set(["מטלי", "מטאלי", "מטל", "מתכתי", "מט", "פנינה", "מבריק", "קריסטל", "קלאסי", "זוהר", "חזק", "ים", "פלדה", "מילניום", "אקווה"]);

// Multi-word phrases collapsed to one word before tokenizing.
const PHRASES: [RegExp, string][] = [[/שן\s*פיל/g, "קרם"]];

const NEUTRAL_WORDS = new Set(["אחר", "ידוע", "גווני"]);

function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (target - c) * amount));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function tokens(raw: string): string[] {
  let v = raw.trim();
  for (const [re, to] of PHRASES) v = v.replace(re, to);
  return v
    .replace(/[׳'"()־\-–,./]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const warned = new Set<string>();

export function colorTint(raw: string | null | undefined): ColorTint {
  const words = tokens(raw ?? "").filter((w) => !IGNORED.has(w));

  let base: string | null = null;
  let shade: "dark" | "light" | null = null;
  for (const w of words) {
    if (!base) {
      const b = BASE_HEX[w] ? w : ALIASES[w];
      if (b) base = b;
    }
    if (!shade && w === "כהה") shade = "dark";
    if (!shade && w === "בהיר") shade = "light";
  }

  if (!base) {
    const text = (raw ?? "").trim();
    const expectedNeutral = words.some((w) => NEUTRAL_WORDS.has(w));
    if (text && !expectedNeutral && process.env.NODE_ENV === "development" && !warned.has(text)) {
      warned.add(text);
      console.warn(`[vehicle-color] unknown color "${text}", using neutral gray`);
    }
    return { hex: NEUTRAL_HEX, outline: "#374151", light: false, known: false };
  }

  let hex = BASE_HEX[base];
  if (shade === "dark") hex = mix(hex, 0, 0.38);
  if (shade === "light") hex = mix(hex, 255, 0.42);
  const light = luminance(hex) > 0.55;
  return { hex, outline: light ? "#6b7280" : "#374151", light, known: true };
}
