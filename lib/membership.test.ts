import { describe, expect, it } from "vitest";
import { pickMembership } from "./membership";

const row = (family_id: string, created_at: string, role: "admin" | "member" = "member") => ({ family_id, created_at, role });

describe("pickMembership", () => {
  it("returns null without memberships", () => {
    expect(pickMembership([])).toBeNull();
  });
  it("picks the oldest membership regardless of input order", () => {
    const a = row("f2", "2026-11-02T10:00:00Z");
    const b = row("f1", "2026-11-01T10:00:00Z");
    expect(pickMembership([a, b])?.family_id).toBe("f1");
    expect(pickMembership([b, a])?.family_id).toBe("f1");
  });
  it("breaks ties by family id", () => {
    const t = "2026-11-01T10:00:00Z";
    expect(pickMembership([row("b", t), row("a", t)])?.family_id).toBe("a");
  });
});
