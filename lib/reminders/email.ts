import { LEVEL_LABEL } from "@/lib/alerts";
import { formatPlate } from "@/lib/format";
import type { ReminderItem } from "./digest";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const LEVEL_COLOR = { overdue: "#b91c1c", urgent: "#c2410c", soon: "#a16207", ok: "#15803d" } as const;

/** Hebrew, right-to-left digest. All dynamic text is escaped; no external images or scripts. */
export function renderDigestEmail(opts: { familyName: string; items: ReminderItem[]; appUrl: string }): RenderedEmail {
  const { familyName, items, appUrl } = opts;
  const count = items.length;
  const urgent = items.filter((i) => i.alert.level === "overdue" || i.alert.level === "urgent").length;
  const subject = urgent > 0 ? `${urgent} ${urgent === 1 ? "פעולה דחופה" : "פעולות דחופות"} ברכבי ${familyName}` : `${count} ${count === 1 ? "תזכורת" : "תזכורות"} ברכבי ${familyName}`;

  const rows = items
    .map((i) => {
      const color = LEVEL_COLOR[i.alert.level];
      return `<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">
<div style="font-weight:700">${escapeHtml(i.vehicleName)} <span dir="ltr" style="color:#6b7280;font-weight:400">${escapeHtml(formatPlate(i.plate))}</span></div>
<div><span style="color:${color};font-weight:700">${LEVEL_LABEL[i.alert.level]}</span> · ${escapeHtml(i.alert.title)}</div>
<div style="color:#4b5563;font-size:14px">${escapeHtml(i.alert.detail)}</div>
</td></tr>`;
    })
    .join("\n");

  const link = `${appUrl.replace(/\/+$/, "")}/`;
  const html = `<!doctype html>
<html lang="he" dir="rtl"><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;padding:16px">
<h1 style="font-size:20px;margin:8px 0">${escapeHtml(subject)}</h1>
<table role="presentation" width="100%" cellspacing="0" style="background:#fff;border:1px solid #dde0e5;border-radius:12px;border-collapse:separate">
${rows}
</table>
<p style="margin:16px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">פתיחת האפליקציה</a></p>
<p style="color:#6b7280;font-size:12px">תזכורות מסומנות ״הערכה״ מבוססות על ברירות מחדל ועשויות לא להתאים לרכב שלכם.</p>
</div></body></html>`;

  const text = [subject, "", ...items.map((i) => `- ${i.vehicleName} (${formatPlate(i.plate)}): ${LEVEL_LABEL[i.alert.level]} · ${i.alert.title} · ${i.alert.detail}`), "", link].join("\n");
  return { subject, html, text };
}
