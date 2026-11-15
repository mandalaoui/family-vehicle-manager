// Maps a record of the Ministry of Transport vehicle dataset (data.gov.il, resource
// 053cea08-09bc-40ec-8f7a-156f0677aff3) to our vehicle fields. Field names verified against the live API:
// tozeret_nm, kinuy_mishari, degem_nm, shnat_yitzur, tzeva_rechev, sug_delek_nm, mivchan_acharon_dt, tokef_dt.
import type { FuelType } from "@/types/database";

export interface MinistryRecord {
  tozeret_nm?: string | null;
  kinuy_mishari?: string | null;
  degem_nm?: string | null;
  shnat_yitzur?: number | string | null;
  tzeva_rechev?: string | null;
  sug_delek_nm?: string | null;
  mivchan_acharon_dt?: string | null;
  tokef_dt?: string | null;
}

export interface MinistryVehicle {
  make: string;
  model: string;
  year: number | null;
  /** The ministry's color text as returned (e.g. "אפור כהה מטלי"), null when missing. Only the tint is normalized (lib/vehicle-color.ts). */
  color: string | null;
  fuel_type: FuelType | null;
  /** tokef_dt: the next annual test / license renewal date. */
  valid_until: string | null;
  /** mivchan_acharon_dt: information only. */
  last_test: string | null;
}

const COUNTRY_SUFFIXES = new Set([
  "גרמניה", "יפן", "קוריאה", 'ארה"ב', "צרפת", "איטליה", "בריטניה", "אנגליה", "שוודיה", "ספרד", "סין", "הודו",
  "טורקיה", "רומניה", "הונגריה", "סלובקיה", "מקסיקו", "תאילנד", "בלגיה", "הולנד", "אוסטריה", "פולין", "פורטוגל",
  "צ'כיה", "סלובניה", "דרום", "אפריקה", "רוסיה", "אוקראינה", "מלזיה", "אינדונזיה", "ברזיל", "קנדה", "ישראל",
]);

// A trailing abbreviation such as "ד." / "ק." (one Hebrew letter + dot, optionally with a geresh) is
// a country/variant marker in the dataset ("קיה ד."), not part of the make.
const ABBREVIATION = /^[א-ת]['׳]?\.$/;

export function cleanMake(raw: string | null | undefined): string {
  const words = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  while (words.length > 1) {
    const last = words[words.length - 1];
    if (COUNTRY_SUFFIXES.has(last) || ABBREVIATION.test(last)) words.pop();
    else break;
  }
  return words.join(" ");
}

/** The ministry's color text, kept exactly as returned (spaces collapsed, max 30 chars like the DB column). */
export function cleanColor(raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
  return v || null;
}

export function mapFuel(raw: string | null | undefined): FuelType | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/פלאג|פלאג־אין|נטען|plug/i.test(v)) return "plug_in";
  if (/היברידי|משולב|hybrid/i.test(v)) return "hybrid";
  if (/חשמל/.test(v) && !/בנזין|דיזל|סולר/.test(v)) return "electric";
  if (/דיזל|סולר/.test(v)) return "diesel";
  if (/בנזין/.test(v)) return "petrol";
  return null;
}

const ISO = /^\d{4}-\d{2}-\d{2}/;
const isoDate = (v: string | null | undefined) => (v && ISO.test(v) ? v.slice(0, 10) : null);

export function mapMinistryRecord(r: MinistryRecord): MinistryVehicle {
  const year = Number(r.shnat_yitzur);
  return {
    make: cleanMake(r.tozeret_nm),
    model: (r.kinuy_mishari ?? "").trim() || (r.degem_nm ?? "").trim(),
    year: Number.isInteger(year) && year >= 1950 && year <= 2100 ? year : null,
    color: cleanColor(r.tzeva_rechev),
    fuel_type: mapFuel(r.sug_delek_nm),
    valid_until: isoDate(r.tokef_dt),
    last_test: isoDate(r.mivchan_acharon_dt),
  };
}
