/** Minimal client for the local Mailpit inbox started by `supabase start`. */
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

interface Summary {
  ID: string;
  Subject: string;
}

export async function waitForLink(
  to: string,
  contains: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (res.ok) {
      const { messages } = (await res.json()) as { messages: Summary[] };
      for (const m of messages ?? []) {
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as {
          Text: string;
          HTML: string;
        };
        const links = `${msg.Text}\n${msg.HTML}`.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
        const link = links.map((l) => l.replace(/&amp;/g, '&')).find((l) => l.includes(contains));
        if (link) return link;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no e-mail to ${to} with a link containing "${contains}"`);
}

export async function clearInbox(to: string): Promise<void> {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`, {
    method: 'DELETE',
  });
}
