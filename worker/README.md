# Application relay

Forwards a submitted application from the landing page to the Telegram bot.

It exists because the landing page is static. GitHub Pages serves files, it does
not run code, so the page can never hold the bot token without publishing it.
This Worker is the only thing that sees the token.

## Deploy

From this directory:

```bash
npx wrangler login          # opens a browser, one time
npx wrangler secret put BOT_TOKEN
npx wrangler secret put CHAT_ID
npx wrangler deploy
```

`wrangler secret put` prompts for the value and sends it straight to
Cloudflare's secret store. Nothing is written to disk and nothing enters git.

Deploy prints the URL, something like:

```
https://unstuck-apply.<your-subdomain>.workers.dev
```

Put that in `FORM_ENDPOINT` at the top of `../main.js`, then commit and push.

## Getting CHAT_ID

Message the bot (or add it to a group and post there), then:

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | grep -o '"id":-\?[0-9]*'
```

The chat id for a private chat is positive; a group is negative.

## Checking it works

```bash
curl -X POST https://unstuck-apply.<your-subdomain>.workers.dev \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"t@example.com","project":"Checking the relay"}'
```

Expect `{"ok":true}` and a message in the chat.

## Notes

- `ALLOWED_ORIGIN` in `wrangler.toml` restricts which site may post here. It is
  a browser-enforced control, not a security boundary. Anything can POST to this
  URL with curl, so treat the endpoint as public.
- Field answers are capped at 2000 characters and the whole message at Telegram's
  4096 limit, so a long application is truncated rather than silently dropped.
- If Telegram rejects the send, the Worker returns 502 and the page shows its
  "that didn't go through" error rather than a false confirmation.
