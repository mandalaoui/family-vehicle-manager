"use client";

import { WHEEL_LABELS, type AlertLevel, type WheelKey } from "@/lib/alerts";
import { Status } from "@/components/ui/Status";
import { Ltr } from "@/components/ui/Plate";
import { formatDate } from "@/lib/format";

export interface WheelView {
  /** ISO date shown under the wheel, or null. */
  date: string | null;
  /** Null = no date entered. */
  level: AlertLevel | null;
}

const WHEEL_FILL: Record<AlertLevel | "none", string> = {
  ok: "#16a34a",
  soon: "#d97706",
  urgent: "#ea580c",
  overdue: "#dc2626",
  none: "#9ca3af",
};

const CARD: Record<AlertLevel | "none", string> = {
  ok: "border-green-300 bg-green-50",
  soon: "border-amber-300 bg-amber-50",
  urgent: "border-orange-400 bg-orange-50",
  overdue: "border-red-300 bg-red-50",
  none: "border-dashed border-silver-300 bg-silver-50",
};

// The accessible name of each wheel button is its visible content (name, date, status), in that order,
// so what a screen reader announces matches what is on screen (WCAG 2.5.3 Label in Name).

// Positions of the wheels inside the car SVG (viewBox 0 0 100 210). Front of the car is at the TOP.
// Right/left are the car's own sides when facing forward, so the car's right is the RIGHT of the screen.
const WHEEL_RECT: Record<WheelKey, { x: number; y: number }> = {
  fl: { x: 3, y: 34 },
  fr: { x: 83, y: 34 },
  rl: { x: 3, y: 140 },
  rr: { x: 83, y: 140 },
};

function CarSvg({ wheels, selected }: { wheels: Record<WheelKey, WheelView>; selected: Set<WheelKey> }) {
  return (
    <svg viewBox="0 0 100 210" className="h-[210px] w-[100px]" role="img" aria-label="תרשים רכב מלמעלה, החזית למעלה" focusable="false">
      <path d="M50 6 C74 6 86 20 86 44 L86 168 C86 192 74 204 50 204 C26 204 14 192 14 168 L14 44 C14 20 26 6 50 6 Z" fill="#f3f4f6" stroke="#374151" strokeWidth="2.5" />
      <path d="M26 52 L74 52 L68 82 L32 82 Z" fill="#dbeafe" stroke="#374151" strokeWidth="2" strokeLinejoin="round" />
      <rect x="30" y="92" width="40" height="46" rx="6" fill="#e5e7eb" stroke="#374151" strokeWidth="1.5" />
      <path d="M32 150 L68 150 L74 172 L26 172 Z" fill="#dbeafe" stroke="#374151" strokeWidth="2" strokeLinejoin="round" />
      {(Object.keys(WHEEL_RECT) as WheelKey[]).map((k) => {
        const { x, y } = WHEEL_RECT[k];
        const isSel = selected.has(k);
        return (
          <rect
            key={k}
            x={x}
            y={y}
            width="14"
            height="36"
            rx="4"
            fill={WHEEL_FILL[wheels[k].level ?? "none"]}
            stroke={isSel ? "#1d4ed8" : "#111827"}
            strokeWidth={isSel ? 3.5 : 1.5}
          />
        );
      })}
    </svg>
  );
}

function WheelButton({
  wheelKey,
  view,
  selected,
  onSelect,
}: {
  wheelKey: WheelKey;
  view: WheelView;
  selected: boolean;
  onSelect: (k: WheelKey) => void;
}) {
  const label = WHEEL_LABELS[wheelKey];
  return (
    <button
      type="button"
      onClick={() => onSelect(wheelKey)}
      aria-pressed={selected}
      className={`flex min-h-[88px] w-full min-w-0 flex-col items-center justify-center gap-1 self-center rounded-xl border-2 p-1.5 text-center ${CARD[view.level ?? "none"]} ${
        selected ? "ring-4 ring-brand ring-offset-1" : ""
      }`}
    >
      <span className="text-[13px] font-bold leading-tight">{label}</span>
      <span className="text-xs text-muted">{view.date ? <Ltr>{formatDate(view.date)}</Ltr> : <span aria-hidden>—</span>}</span>
      {view.level ? (
        <Status level={view.level} />
      ) : (
        <span className="inline-flex items-center rounded-full border border-silver-300 bg-white px-2 py-0.5 text-xs font-bold text-muted">לא הוזן</span>
      )}
    </button>
  );
}

/**
 * Top view of the car, front at the top. The wrapper is forced to dir="ltr" so the page's RTL never
 * mirrors the car: the car's right side stays on the right of the screen (driver-facing-forward view).
 */
export function TireDiagram({
  wheels,
  selected,
  onSelect,
}: {
  wheels: Record<WheelKey, WheelView>;
  selected: Set<WheelKey>;
  onSelect: (k: WheelKey) => void;
}) {
  return (
    <div>
      <div dir="ltr" className="mx-auto grid w-full max-w-[330px] grid-cols-[1fr_100px_1fr] grid-rows-[auto_105px_105px_auto] gap-x-1.5">
        <p className="col-start-2 row-start-1 text-center text-xs font-bold">▲ חזית</p>
        <div className="col-start-2 row-span-2 row-start-2">
          <CarSvg wheels={wheels} selected={selected} />
        </div>
        <div className="col-start-1 row-start-2 flex">
          <WheelButton wheelKey="fl" view={wheels.fl} selected={selected.has("fl")} onSelect={onSelect} />
        </div>
        <div className="col-start-3 row-start-2 flex">
          <WheelButton wheelKey="fr" view={wheels.fr} selected={selected.has("fr")} onSelect={onSelect} />
        </div>
        <div className="col-start-1 row-start-3 flex">
          <WheelButton wheelKey="rl" view={wheels.rl} selected={selected.has("rl")} onSelect={onSelect} />
        </div>
        <div className="col-start-3 row-start-3 flex">
          <WheelButton wheelKey="rr" view={wheels.rr} selected={selected.has("rr")} onSelect={onSelect} />
        </div>
        <p className="col-start-2 row-start-4 text-center text-xs font-bold text-muted">אחור</p>
      </div>

      <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="מקרא">
        {(["ok", "soon", "urgent", "overdue"] as const).map((l) => (
          <li key={l}>
            <Status level={l} />
          </li>
        ))}
        <li>
          <span className="inline-flex items-center rounded-full border border-dashed border-silver-300 bg-silver-50 px-2.5 py-0.5 text-xs font-bold text-muted">לא הוזן</span>
        </li>
      </ul>
    </div>
  );
}
