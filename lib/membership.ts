export interface MembershipRow {
  family_id: string;
  role: "admin" | "member";
  created_at: string;
}

/**
 * The app shows one family per user. If the database holds several memberships (old data from before
 * single-family was enforced), pick the same one every time: oldest first, ties broken by family id.
 */
export function pickMembership<T extends MembershipRow>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.family_id.localeCompare(b.family_id))[0];
}
