// Email delivery through Resend (https://resend.com). With EMAIL_DRY_RUN=true the
// messages are stored in the D1 `outbox` table instead, for local testing.

const RESEND = 'https://api.resend.com';

// messages: [{ to, subject, text, headers? }]
export async function sendEmails(env, messages) {
  if (!messages.length) return { sent: 0 };
  if (env.EMAIL_DRY_RUN === 'true') {
    const now = new Date().toISOString();
    await env.DB.batch(messages.map((m) => env.DB.prepare('INSERT INTO outbox (to_email, subject, body, created_at) VALUES (?, ?, ?, ?)').bind(m.to, m.subject, m.text, now)));
    return { sent: messages.length, dryRun: true };
  }
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('RESEND_API_KEY and EMAIL_FROM must be set');
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({
      from: env.EMAIL_FROM,
      to: [m.to],
      subject: m.subject,
      text: m.text,
      headers: m.headers || {},
    }));
    const res = await fetch(`${RESEND}/emails/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    sent += chunk.length;
  }
  return { sent };
}

export function loginCodeEmail(siteName, code) {
  return {
    subject: `${code} is your ${siteName} sign-in code`,
    text: `Your sign-in code is ${code}\n\nIt expires in 10 minutes. If you did not ask for it, you can ignore this email.\n\n${siteName}`,
  };
}

// items: [{ code, name, nameZh, period, periodLabel, rev, yoy, mom, url }] (already formatted)
export function alertEmail({ siteName, siteUrl, items, unsubscribeUrl }) {
  const names = items.map((i) => i.name);
  const subject = `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3} more` : ''} reported ${items[0].periodLabel} revenue`;
  const lines = items.map((i) => `${i.name} (${i.code}${i.nameZh ? ` ${i.nameZh}` : ''})\n  ${i.periodLabel}: ${i.rev} | ${i.yoy} YoY | ${i.mom} MoM\n  ${i.url}`);
  const text = `New monthly revenue filings for companies on your watchlist:\n\n${lines.join('\n\n')}\n\nFigures are as filed by the companies (unaudited) and link to the official source on each page.\n\n--\nManage your watchlist: ${siteUrl}/account/\nStop alert emails: ${unsubscribeUrl}\n${siteName}. Not investment advice.`;
  return { subject, text };
}

export function summaryEmail({ siteName, siteUrl, period, periodLabel, lines, unsubscribeUrl }) {
  return {
    subject: `${periodLabel} reporting is complete: Taiwan monthly revenue summary`,
    text: `${lines.join('\n')}\n\nFull report: ${siteUrl}/reports/${period}/\n\n--\nManage your alerts: ${siteUrl}/account/\nStop alert emails: ${unsubscribeUrl}\n${siteName}. Not investment advice.`,
  };
}
