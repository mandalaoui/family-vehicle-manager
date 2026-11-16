import { describe, expect, it } from "vitest";
import { isPublic } from "./middleware";

describe("public routes", () => {
  it("serves the home page without a login redirect", () => {
    expect(isPublic("/")).toBe(true);
    expect(isPublic("/login")).toBe(true);
    expect(isPublic("/privacy")).toBe(true);
    expect(isPublic("/terms")).toBe(true);
    expect(isPublic("/home")).toBe(false);
    expect(isPublic("/vehicles")).toBe(false);
  });
});
