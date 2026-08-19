<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

## Project: RAMICHE Site

- **Stack:** Next.js 16.2, React 19, Tailwind 4, Firebase Auth, Supabase
- **Deploy:** Vercel
- **Design:** Futuristic game aesthetic (Fortnite/Fallout), NOT corporate
- **Design tokens:** `#0e0e18` bg, `#00f0ff` cyan, `#a855f7` purple, `#f59e0b` amber, glassmorphism

<!-- PARALLAX-BRAND-BLOCK v1 — generated from ~/.openclaw/BRANDS.md. Edit there, not here. -->
## This repo's brand: RAMICHE

**What it is:** Ramon's own music, as artist and producer
**Creed:** The craft is the story: the writing, the production, the track.
**Rules:** HARD RULE: Ramiche's music is NOT AI produced. He writes and produces it himself. No post, caption or script may claim or imply AI made, rendered or co-produced a track. The AI lane is a SEPARATE brand (ramichestudio) with its own token.

### Posting: you submit, Ramon approves

This repo's accounts (5), reachable by its token and nothing else:
- facebook:@Ramiche Music
- facebook:@R A M Ï C H E
- youtube:@PROD. RAMICHE
- instagram:@ramichemusic
- tiktok:@RAMICHE

```bash
curl -X POST https://parallax-publish.vercel.app/api/service/queue \
  -H "authorization: Bearer $PARALLAX_PUBLISH_TOKEN" \
  -H "content-type: application/json" \
  -d '{"agentName":"ramiche-repo","note":"why this is worth posting","content":"the caption","platforms":["instagram","twitter","facebook","youtube","tiktok"],"mediaUrls":["https://<public https url>"]}'
```

Omit `accounts` and it fans out to every RAMICHE account on every platform you list. The
token cannot reach another brand, so this is safe to run broad. You get back the exact text
each account will receive; read it before moving on. Poll `GET /api/service/queue/<id>` for
the decision. Approving is Ramon's, at https://parallax-publish.vercel.app/queue

**You never publish directly.** A 401 or a 403 from `/api/service/publish` is the guard
working, not a broken integration. Do not ask for a publishing credential to be injected.

**Media must be a public https URL.** Platforms fetch it server side, so a local path or a
private host cannot work. The endpoint refuses at submit rather than failing later.

**Never post to Saint Andrew's Aquatics** (@sa_aquatics, FB 337006246418688). Client, not
ours. Enforced in code on every path.

**Brand voice, all brands:** no em dashes, no en dashes, no ellipses. Plain human sentences.
No hype adjectives, no invented numbers. Every figure traces to something measured.

**Full registry, all brands and services:** `~/.openclaw/BRANDS.md`
<!-- /PARALLAX-BRAND-BLOCK -->
