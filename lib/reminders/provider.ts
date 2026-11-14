import type { RenderedEmail } from "./email";

export interface OutgoingEmail extends RenderedEmail {
  to: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: OutgoingEmail): Promise<{ id: string | null }>;
}

/** Default: sends nothing, only reports what would have been sent (no addresses are logged). */
export function consoleProvider(log: (line: string) => void = console.log): EmailProvider {
  return {
    name: "console",
    async send(message) {
      log(`[reminders:dry-run] would send "${message.subject}" (${message.text.length} chars)`);
      return { id: null };
    },
  };
}

/** Resend (https://resend.com) over plain fetch. Only constructed when explicitly configured. */
export function resendProvider(opts: { apiKey: string; from: string; fetchImpl?: typeof fetch }): EmailProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    name: "resend",
    async send(message) {
      const res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: opts.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`resend responded ${res.status}`);
      const body = (await res.json()) as { id?: string };
      return { id: body.id ?? null };
    },
  };
}

/** Chooses the provider from env. Anything unknown or incomplete falls back to the dry-run provider. */
export function providerFromEnv(env: Record<string, string | undefined>): EmailProvider {
  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY && env.EMAIL_FROM) {
    return resendProvider({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  return consoleProvider();
}
