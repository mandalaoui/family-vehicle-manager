/** Same naming rule as the UI: nickname, otherwise "make model". */
export function vehicleDisplayName(v: { nickname: string | null; make: string; model: string }): string {
  return v.nickname?.trim() || `${v.make} ${v.model}`.trim();
}
