// Free, keyless deep links for a garage (no paid APIs).
export interface GarageLinkInput {
  name: string;
  phone?: string | null;
  address?: string | null;
}

/** tel: link with digits and a leading + only; null when there is no usable number. */
export function telHref(phone: string | null | undefined): string | null {
  const cleaned = (phone ?? "").replace(/[^\d+]/g, "");
  return cleaned.replace(/\+/g, "").length >= 3 ? `tel:${cleaned}` : null;
}

/** What to search for: the address when known, otherwise the garage name. */
export function placeQuery(g: GarageLinkInput): string {
  return (g.address?.trim() || g.name.trim()).slice(0, 200);
}

export function wazeUrl(g: GarageLinkInput): string {
  return `https://waze.com/ul?q=${encodeURIComponent(placeQuery(g))}&navigate=yes`;
}

export function mapsUrl(g: GarageLinkInput): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(g))}`;
}
