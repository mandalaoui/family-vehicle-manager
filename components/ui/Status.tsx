import { CircleAlert, CircleCheck, Clock, TriangleAlert, type LucideIcon } from "lucide-react";
import { LEVEL_LABEL, type AlertLevel } from "@/lib/alerts";

// Level is always conveyed by label + icon, never by color alone.
export const LEVEL_STYLE: Record<AlertLevel, { icon: LucideIcon; cls: string }> = {
  overdue: { icon: TriangleAlert, cls: "bg-red-50 text-red-800 border-red-300" },
  urgent: { icon: CircleAlert, cls: "bg-orange-50 text-orange-900 border-orange-400" },
  soon: { icon: Clock, cls: "bg-amber-50 text-amber-900 border-amber-300" },
  ok: { icon: CircleCheck, cls: "bg-green-50 text-green-800 border-green-300" },
};

export function Status({ level, label }: { level: AlertLevel; label?: string }) {
  const { icon: Icon, cls } = LEVEL_STYLE[level];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      <Icon size={14} aria-hidden />
      {label ?? LEVEL_LABEL[level]}
    </span>
  );
}
