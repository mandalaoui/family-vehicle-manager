import { describe, expect, it, vi } from "vitest";
import { collectReminders, reminderKey, selectNewReminders, type ReminderVehicle } from "./digest";
import { renderDigestEmail } from "./email";
import { consoleProvider, providerFromEnv, resendProvider } from "./provider";
import { isAuthorizedCron } from "./cron-auth";

const today = "2026-11-14";
const vehicle = (over: Partial<ReminderVehicle> = {}): ReminderVehicle => ({
  id: "v1",
  plate: "1234567",
  nickname: null,
  make: "קיה",
  model: "נירו",
  license_due: null,
  insurance_due: null,
  mileage: 50000,
  mileage_updated_at: today,
  next_service_km: 60000,
  service_interval_km: 10000,
  created_at: "2026-06-01T10:00:00Z",
  ...over,
});

describe("collectReminders", () => {
  it("keeps only soon, urgent and overdue, most urgent first", () => {
    const items = collectReminders([vehicle({ license_due: "2026-11-20", insurance_due: "2026-10-01" })], today);
    expect(items.map((i) => i.alert.kind)).toEqual(["insurance", "license"]);
    expect(items[0].alert.level).toBe("overdue");
    expect(items[1].alert.level).toBe("urgent");
  });
  it("skips ok alerts and the mileage nudge", () => {
    const items = collectReminders([vehicle({ license_due: "2027-06-01", mileage_updated_at: "2026-01-01" })], today);
    expect(items).toEqual([]);
  });
  it("can leave out estimated alerts", () => {
    const v = vehicle({ battery_replaced_at: "2023-01-01", battery_reminder_months: 36 });
    expect(collectReminders([v], today).some((i) => i.alert.kind === "battery")).toBe(true);
    expect(collectReminders([v], today, { includeEstimates: false }).some((i) => i.alert.kind === "battery")).toBe(false);
  });
  it("uses the nickname, otherwise make and model", () => {
    const named = collectReminders([vehicle({ nickname: "הקורולה של אבא", license_due: "2026-11-01" })], today);
    expect(named[0].vehicleName).toBe("הקורולה של אבא");
    const plain = collectReminders([vehicle({ license_due: "2026-11-01" })], today);
    expect(plain[0].vehicleName).toBe("קיה נירו");
  });
});

describe("selectNewReminders", () => {
  const items = collectReminders([vehicle({ license_due: "2026-11-01" })], today); // overdue
  it("sends something new", () => {
    expect(selectNewReminders(items, new Map(), today)).toHaveLength(1);
  });
  it("does not repeat the same level within a week", () => {
    const sent = new Map([[items[0].key, "2026-11-10"]]);
    expect(selectNewReminders(items, sent, today)).toHaveLength(0);
  });
  it("repeats overdue after the repeat window", () => {
    const sent = new Map([[items[0].key, "2026-11-01"]]);
    expect(selectNewReminders(items, sent, today)).toHaveLength(1);
  });
  it("mails again when the level gets worse (different key)", () => {
    const sent = new Map([[reminderKey("v1", { kind: "license", level: "urgent" }), "2026-11-13"]]);
    expect(selectNewReminders(items, sent, today)).toHaveLength(1);
  });
  it("never repeats a non-overdue level", () => {
    const soon = collectReminders([vehicle({ license_due: "2026-12-01" })], today);
    const sent = new Map([[soon[0].key, "2026-01-01"]]);
    expect(selectNewReminders(soon, sent, today)).toHaveLength(0);
  });
});

describe("renderDigestEmail", () => {
  const items = collectReminders([vehicle({ nickname: "<b>רכב</b>", license_due: "2026-11-01" })], today);
  it("builds an RTL Hebrew digest with a subject that counts urgent items", () => {
    const mail = renderDigestEmail({ familyName: "משפחת כהן", items, appUrl: "https://app.example.com/" });
    expect(mail.subject).toBe("1 פעולה דחופה ברכבי משפחת כהן");
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.html).toContain("https://app.example.com/");
    expect(mail.text).toContain("12-345-67");
  });
  it("escapes dynamic text", () => {
    const mail = renderDigestEmail({ familyName: "<script>x</script>", items, appUrl: "https://app.example.com" });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<b>רכב</b>");
    expect(mail.html).toContain("&lt;b&gt;");
  });
});

describe("providers", () => {
  it("the console provider only logs and sends nothing", async () => {
    const log = vi.fn();
    const r = await consoleProvider(log).send({ to: "a@x.com", subject: "s", html: "<p>h</p>", text: "t" });
    expect(r.id).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).not.toContain("a@x.com");
  });
  it("falls back to the dry-run provider unless fully configured", () => {
    expect(providerFromEnv({}).name).toBe("console");
    expect(providerFromEnv({ EMAIL_PROVIDER: "resend" }).name).toBe("console");
    expect(providerFromEnv({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "k", EMAIL_FROM: "a@b.co" }).name).toBe("resend");
  });
  it("posts to Resend with a bearer key and reports failures", async () => {
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "m1" }), { status: 200 }));
    const p = resendProvider({ apiKey: "secret", from: "a@b.co", fetchImpl: ok as unknown as typeof fetch });
    expect((await p.send({ to: "u@x.com", subject: "s", html: "h", text: "t" })).id).toBe("m1");
    const init = ok.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect(JSON.parse(init.body as string).to).toEqual(["u@x.com"]);

    const bad = vi.fn().mockResolvedValue(new Response("no", { status: 500 }));
    const p2 = resendProvider({ apiKey: "k", from: "a@b.co", fetchImpl: bad as unknown as typeof fetch });
    await expect(p2.send({ to: "u@x.com", subject: "s", html: "h", text: "t" })).rejects.toThrow("500");
  });
});

describe("isAuthorizedCron", () => {
  const secret = "0123456789abcdef-secret";
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCron(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorizedCron(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorizedCron("Bearer nope", secret)).toBe(false);
    expect(isAuthorizedCron(null, secret)).toBe(false);
  });
  it("is closed when no (or a short) secret is configured", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer short", "short")).toBe(false);
  });
});
