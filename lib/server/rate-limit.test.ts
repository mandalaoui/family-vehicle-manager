import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { rateLimited } from "./rate-limit";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("rateLimited", () => {
  it("allows up to the limit, then blocks", () => {
    const key = "t:limit";
    expect([1, 2, 3].map(() => rateLimited(key, 3, 60_000))).toEqual([false, false, false]);
    expect(rateLimited(key, 3, 60_000)).toBe(true);
    expect(rateLimited(key, 3, 60_000)).toBe(true);
  });

  it("frees up again after the window", () => {
    const key = "t:window";
    rateLimited(key, 1, 1000);
    expect(rateLimited(key, 1, 1000)).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(rateLimited(key, 1, 1000)).toBe(false);
  });

  it("counts every key separately", () => {
    rateLimited("t:a", 1, 60_000);
    expect(rateLimited("t:a", 1, 60_000)).toBe(true);
    expect(rateLimited("t:b", 1, 60_000)).toBe(false);
  });

  it("does not count blocked attempts against the window", () => {
    const key = "t:blocked";
    rateLimited(key, 1, 1000);
    vi.advanceTimersByTime(500);
    expect(rateLimited(key, 1, 1000)).toBe(true);
    vi.advanceTimersByTime(501); // 1001ms after the first (allowed) hit
    expect(rateLimited(key, 1, 1000)).toBe(false);
  });
});
