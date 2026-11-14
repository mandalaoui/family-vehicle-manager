import { describe, expect, it } from "vitest";
import { mapsUrl, placeQuery, telHref, wazeUrl } from "./garage-links";

describe("garage links", () => {
  it("builds a tel: link from a formatted number", () => {
    expect(telHref("03-123 4567")).toBe("tel:031234567");
    expect(telHref("+972 50-123-4567")).toBe("tel:+972501234567");
  });
  it("returns null without a usable number", () => {
    expect(telHref(null)).toBeNull();
    expect(telHref("ab")).toBeNull();
  });
  it("searches by address, falling back to the name", () => {
    expect(placeQuery({ name: "מוסך משה", address: "הרצל 5, חיפה" })).toBe("הרצל 5, חיפה");
    expect(placeQuery({ name: "מוסך משה", address: "  " })).toBe("מוסך משה");
  });
  it("encodes Waze and Google Maps URLs", () => {
    const g = { name: "מוסך & בניו", address: null };
    expect(wazeUrl(g)).toBe(`https://waze.com/ul?q=${encodeURIComponent("מוסך & בניו")}&navigate=yes`);
    expect(mapsUrl(g)).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(mapsUrl(g)).not.toContain("&בניו");
  });
});
