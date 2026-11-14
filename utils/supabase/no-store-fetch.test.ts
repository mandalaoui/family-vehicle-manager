import { afterEach, describe, expect, it, vi } from "vitest";
import { noStoreFetch } from "./no-store-fetch";

afterEach(() => vi.unstubAllGlobals());

describe("noStoreFetch", () => {
  it("forces cache: no-store and keeps the other init options", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", spy);
    await noStoreFetch("https://example.supabase.co/rest/v1/vehicles", { method: "GET", headers: { a: "b" }, cache: "force-cache" });
    expect(spy).toHaveBeenCalledTimes(1);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.cache).toBe("no-store");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ a: "b" });
  });
});
