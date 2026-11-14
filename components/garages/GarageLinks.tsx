import { MapPin, Navigation, Phone } from "lucide-react";
import { mapsUrl, telHref, wazeUrl, type GarageLinkInput } from "@/lib/garage-links";

const linkClass =
  "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-silver-300 bg-white px-3 text-sm font-semibold hover:bg-silver-100";

/** Call / Waze / Google Maps buttons (plain links, no API keys). */
export function GarageLinks({ garage }: { garage: GarageLinkInput }) {
  const tel = telHref(garage.phone);
  return (
    <div className="flex flex-wrap gap-2">
      {tel ? (
        <a href={tel} className={linkClass}>
          <Phone size={16} aria-hidden />
          התקשרות
        </a>
      ) : null}
      <a href={wazeUrl(garage)} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <Navigation size={16} aria-hidden />
        נווט ב־Waze
      </a>
      <a href={mapsUrl(garage)} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <MapPin size={16} aria-hidden />
        פתח במפות
      </a>
    </div>
  );
}
