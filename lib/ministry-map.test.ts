import { describe, expect, it } from "vitest";
import { cleanMake, mapFuel, mapMinistryRecord } from "./ministry-map";

// A real record from the data.gov.il vehicle dataset (field names verified against the live API).
const sample = {
  tozeret_nm: "פורשה גרמניה",
  degem_nm: "982",
  shnat_yitzur: 2018,
  mivchan_acharon_dt: "2026-11-11",
  tokef_dt: "2027-07-15",
  tzeva_rechev: "אפור מטל",
  sug_delek_nm: "בנזין",
  kinuy_mishari: "718 BOXSTER",
};

describe("mapMinistryRecord", () => {
  it("maps the real fields", () => {
    expect(mapMinistryRecord(sample)).toEqual({
      make: "פורשה",
      model: "718 BOXSTER",
      year: 2018,
      color: "אפור",
      fuel_type: "petrol",
      valid_until: "2027-07-15",
      last_test: "2026-11-11",
    });
  });
  it("falls back to degem_nm and tolerates missing data", () => {
    const v = mapMinistryRecord({ tozeret_nm: "טויוטה", degem_nm: "COROLLA", kinuy_mishari: "", tokef_dt: "bad" });
    expect(v.model).toBe("COROLLA");
    expect(v.valid_until).toBeNull();
    expect(v.year).toBeNull();
    expect(v.color).toBeNull();
  });
});

describe("helpers", () => {
  it("strips a trailing country", () => {
    expect(cleanMake("יונדאי קוריאה")).toBe("יונדאי");
    expect(cleanMake("קיה")).toBe("קיה");
    expect(cleanMake("פורשה גרמניה")).toBe("פורשה");
    expect(cleanMake("טויוטה יפן")).toBe("טויוטה");
    expect(cleanMake('פורד ארה"ב')).toBe("פורד");
    expect(cleanMake("סקודה צ'כיה")).toBe("סקודה");
  });
  it("strips trailing abbreviations", () => {
    expect(cleanMake("קיה ד.")).toBe("קיה");
    expect(cleanMake("יונדאי ק.")).toBe("יונדאי");
    expect(cleanMake("מאזדה י.")).toBe("מאזדה");
    expect(cleanMake("קיה ד. ")).toBe("קיה");
    expect(cleanMake("רנו צרפת ד.")).toBe("רנו");
  });
  it("never empties the name and keeps multi-word makes", () => {
    expect(cleanMake("ד.")).toBe("ד.");
    expect(cleanMake("לנד רובר בריטניה")).toBe("לנד רובר");
    expect(cleanMake("ב מ וו")).toBe("ב מ וו");
  });
  it("maps fuels", () => {
    expect(mapFuel("דיזל")).toBe("diesel");
    expect(mapFuel("חשמל")).toBe("electric");
    expect(mapFuel("היברידי בנזין / חשמל")).toBe("hybrid");
    expect(mapFuel("משהו אחר")).toBeNull();
  });
});
