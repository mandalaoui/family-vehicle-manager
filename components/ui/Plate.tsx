import { formatPlate } from "@/lib/format";

export function Plate({ plate }: { plate: string }) {
  return (
    <bdi
      dir="ltr"
      className="inline-flex shrink-0 items-stretch overflow-hidden rounded-md border border-gray-800 bg-yellow-300 text-sm font-bold tracking-wider text-gray-900"
    >
      <span className="grid place-items-center bg-blue-700 px-1 text-[10px] leading-none text-white">IL</span>
      <span className="px-2 py-0.5 tabular-nums">{formatPlate(plate)}</span>
    </bdi>
  );
}

/** Renders digits, emails and similar values left-to-right inside Hebrew text. */
export function Ltr({ children }: { children: React.ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}
