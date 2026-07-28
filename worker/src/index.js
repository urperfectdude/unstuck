/* =============================================================================
   Unstuck House: application relay

   Receives an application POST from the landing page and forwards it to the
   Telegram bot as a readable message.

   This exists for one reason: the bot token must never reach the browser. The
   landing page is static (GitHub Pages), so it cannot hold a secret. This
   Worker can, and it is the only thing that ever sees the token.

   Secrets, set with `wrangler secret put` and never committed:
     BOT_TOKEN   the token from BotFather
     CHAT_ID     the chat the applications land in

   Plain vars (safe in wrangler.toml):
     ALLOWED_ORIGIN   the site allowed to post here
   ========================================================================== */

// Order matters: this is the order fields appear in the Telegram message.
const FIELDS = [
  ['name',           'Name'],
  ['email',          'Email'],
  ['phone',          'Phone / WhatsApp'],
  ['what_you_run',   'Runs'],
  ['links',          'Links'],
  ['project',        'The project'],
  ['stalled',        'Why it stalled'],
  ['win',            'A clear win'],
  ['great_at',       'Great at'],
  ['source',         'Heard via'],
  ['referral_code',  'Referral code'],
  ['commit',         'All three days'],
  ['call_slot',      'Call slot'],
];

const MAX_FIELD = 2000;   // per answer, before we truncate
const MAX_BODY = 20000;   // total request bytes we will read

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }
    if (!env.BOT_TOKEN || !env.CHAT_ID) {
      // Misconfigured rather than the applicant's fault, so say so loudly in
      // the logs but stay vague in the response.
      console.error('BOT_TOKEN or CHAT_ID is not set');
      return json({ error: 'Not configured' }, 500, origin);
    }

    let data;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: 'Too large' }, 413, origin);
      data = JSON.parse(raw);
    } catch {
      return json({ error: 'Bad JSON' }, 400, origin);
    }

    // A name and some way to reply is the minimum worth relaying.
    if (!data || typeof data !== 'object' || !str(data.name)) {
      return json({ error: 'Missing fields' }, 400, origin);
    }

    const sent = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.CHAT_ID,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        text: format(data),
      }),
    });

    if (!sent.ok) {
      console.error('Telegram rejected the message:', sent.status, await sent.text());
      return json({ error: 'Could not deliver' }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  },
};

/* ---------------------------------------------------------------- helpers */

function format(data) {
  const lines = ['<b>New application</b> · Unstuck House'];

  for (const [key, label] of FIELDS) {
    const value = str(data[key]);
    if (!value) continue;
    lines.push('');
    lines.push(`<b>${esc(label)}</b>`);
    lines.push(esc(value));
  }

  const when = str(data.submitted_at);
  if (when) {
    lines.push('');
    lines.push(`<i>${esc(when)}</i>`);
  }

  // Telegram caps a message at 4096 characters.
  const text = lines.join('\n');
  return text.length > 4000 ? text.slice(0, 3990) + '\n<i>[truncated]</i>' : text;
}

function str(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > MAX_FIELD ? trimmed.slice(0, MAX_FIELD) + '…' : trimmed;
}

// Telegram's HTML mode only needs these three escaped.
function esc(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}
