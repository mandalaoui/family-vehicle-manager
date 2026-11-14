import { COLOR_HEX } from "@/lib/format";

// Generic car illustration tinted by the ministry color. No body type is available in the dataset,
// and nothing is fetched from other sites.
function CarIllustration({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 240 110" className="h-full max-h-[110px] w-auto p-1" role="img" aria-label="איור רכב" focusable="false">
      <ellipse cx="120" cy="92" rx="100" ry="6" fill="#000" opacity="0.1" />
      <path
        d="M18 74 L24 56 Q30 46 46 44 L78 42 L96 24 Q100 20 108 20 L150 20 Q158 20 164 26 L184 44 L208 48 Q224 52 224 66 L224 74 Z"
        fill={fill}
        stroke="#374151"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M86 42 L100 28 L124 28 L124 42 Z" fill="#dbeafe" stroke="#374151" strokeWidth="2" strokeLinejoin="round" />
      <path d="M130 28 L152 28 L170 42 L130 42 Z" fill="#dbeafe" stroke="#374151" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="68" cy="76" r="15" fill="#1f2937" />
      <circle cx="68" cy="76" r="6" fill="#9ca3af" />
      <circle cx="178" cy="76" r="15" fill="#1f2937" />
      <circle cx="178" cy="76" r="6" fill="#9ca3af" />
    </svg>
  );
}

export function VehicleImage({
  photoUrl,
  color,
  make,
  alt,
  className = "h-32",
  compact = false,
}: {
  photoUrl?: string | null;
  color: string | null;
  make?: string | null;
  alt: string;
  className?: string;
  /** Thumbnail mode: no manufacturer badge. */
  compact?: boolean;
}) {
  if (photoUrl) {
    return (
      <div className={`relative overflow-hidden bg-silver-100 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private file */}
        <img src={photoUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  const fill = COLOR_HEX[color ?? ""] ?? COLOR_HEX["אחר"];
  return (
    <div className={`relative grid place-items-center bg-silver-100 ${className}`}>
      <CarIllustration fill={fill} />
      {make && !compact ? (
        <span className="absolute top-2 end-2 inline-flex max-w-[60%] items-center gap-1.5 truncate rounded-full bg-white px-2.5 py-0.5 text-xs font-bold shadow-sm">
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand text-[9px] leading-none text-white" aria-hidden>
            {make.slice(0, 1)}
          </span>
          <span className="truncate">{make}</span>
        </span>
      ) : null}
    </div>
  );
}
