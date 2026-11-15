// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/actions/family", () => ({ createFamily: vi.fn() }));

import { extractInviteToken } from "./OnboardingForms";

const TOKEN = "abcdefabcdefabcdefabcdefabcdefab";

describe("extractInviteToken", () => {
  it("accepts a bare token", () => {
    expect(extractInviteToken(TOKEN)).toBe(TOKEN);
    expect(extractInviteToken(`  ${TOKEN}  `)).toBe(TOKEN);
  });
  it("extracts the token from a full invite link", () => {
    expect(extractInviteToken(`https://family-vehicle-manager.vercel.app/invite/${TOKEN}`)).toBe(TOKEN);
    expect(extractInviteToken(`https://x.app/invite/${TOKEN}?utm=1#top`)).toBe(TOKEN);
  });
  it("extracts it from a path without a host", () => {
    expect(extractInviteToken(`/invite/${TOKEN}`)).toBe(TOKEN);
  });
  it("rejects empty input and short or odd tokens", () => {
    expect(extractInviteToken("")).toBeNull();
    expect(extractInviteToken("short")).toBeNull();
    expect(extractInviteToken("https://x.app/invite/")).toBeNull();
    expect(extractInviteToken("not a token at all!!!")).toBeNull();
  });
});
