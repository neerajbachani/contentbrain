# Connect Grok (x_search) to ContentBrain

Live X search uses **your** X Premium / SuperGrok subscription via xAI OAuth. ContentBrain does not bill you per search.

## Prerequisites

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) installed
- X Premium (or Premium+ / SuperGrok) on the account you log in with
- Chrome or Edge (Brave may break OAuth callback)

## Steps

1. Install Hermes (see upstream install docs).

2. Log in with xAI OAuth:

   ```bash
   hermes auth add xai-oauth
   ```

3. Enable X Search:

   ```bash
   hermes tools
   ```

   Arrow to **X (Twitter) Search**, press Space, Enter.

4. Verify:

   ```bash
   hermes auth status xai-oauth
   hermes --tui
   ```

   Prompt: `Use x_search to find posts about [your topic] since:2026-05-01`

5. Copy **the entire** `~/.hermes/auth.json` file (not just `access_token`):
   - ContentBrain needs `refresh_token` under `xai-oauth` to keep x_search working after the access token expires (~1 hour).

6. In ContentBrain **Settings → Grok**, paste the full JSON and tap **Connect**. The server runs a live `x_search` probe — you must see **verified** or an explicit error.

## Read token (WSL)

```bash
cat ~/.hermes/auth.json
# NOT: ~/.hermes/auth.json alone (that tries to execute the file)
```

Extract only `access_token` under `xai-oauth`, or paste the whole JSON — ContentBrain will parse it.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Context says "Could not load" | Check `bun run dev` terminal for `[XContext]` logs |
| OAuth fails in Brave | Use Chrome/Edge |
| `x_search` entitlement error | Try Premium+ or SuperGrok |
| Token expired / `bad-credentials` | Disconnect Grok, paste **full** `auth.json` again (with `refresh_token`), or re-run `hermes auth add xai-oauth` |
| Apify trends/context 403 | Regenerate `APIFY_API_TOKEN` at [console.apify.com](https://console.apify.com/account/integrations) — 403 = invalid or revoked token |
| Grok works in Hermes but app shows AI fallback | Connect must pass probe; check `XAI_MODEL=grok-4.1-fast` in `.env`; see `debug.errors` in Context tab |
| Connect fails immediately | Read alert message — usually HTTP 401 (bad token) or wrong `XAI_MODEL` |
| Settings = Grok only, Grok fails | App now falls back to Apify automatically |
| Prefer no setup | Set **X data source** to **Apify (app)** in Settings |

## Is OpenRouter required for Grok?

**No.** Grok path calls xAI directly (`/v1/responses` + `x_search`). OpenRouter is only used for the **AI-surfaced fallback** when Grok/Apify fail, and for remix/merge analysis.

## Phase 0 validation (founder)

Record result after step 4:

- [ ] OAuth succeeded
- [ ] x_search returned real posts with URLs
- Notes: _______________________________
