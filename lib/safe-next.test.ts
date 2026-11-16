import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("accepts relative paths", () => {
    expect(safeNext("/vehicles/abc?x=1")).toBe("/vehicles/abc?x=1");
    expect(safeNext("/invite/tok")).toBe("/invite/tok");
  });
  it("rejects external and protocol-relative targets", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil.com", "javascript:alert(1)", "/a\nb", ""]) {
      expect(safeNext(bad)).toBe("/home");
    }
    expect(safeNext(null)).toBe("/home");
    expect(safeNext(undefined, "/x")).toBe("/x");
  });
});
